export interface WhatsAppCreds {
  token?: string | null
  phoneNumberId?: string | null
}

function resolverCreds(creds?: WhatsAppCreds) {
  const phoneNumberId = creds?.phoneNumberId || process.env.PHONE_NUMBER_ID
  const token         = creds?.token         || process.env.WHATSAPP_TOKEN

  if (!phoneNumberId || !token) {
    throw new Error('Credenciais WhatsApp não configuradas (PHONE_NUMBER_ID / WHATSAPP_TOKEN)')
  }
  return { phoneNumberId, token }
}

export async function enviarMensagemWhatsApp(
  telefone: string,
  texto: string,
  creds?: WhatsAppCreds
): Promise<string | null> {
  const { phoneNumberId, token } = resolverCreds(creds)
  const numeroLimpo = telefone.replace(/[\s+\-]/g, '')
  console.log(`[WhatsApp] Enviando para: "${numeroLimpo}"`)

  const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numeroLimpo,
      type: 'text',
      text: { body: texto }
    })
  })

  if (!res.ok) {
    const corpo = await res.text()
    throw new Error(`WhatsApp API ${res.status}: ${corpo}`)
  }

  const data = await res.json()
  const waId: string | null = data?.messages?.[0]?.id ?? null
  console.log(`[WhatsApp] Enviado para ${numeroLimpo} (id: ${waId})`)
  return waId
}

// Cache em memória: urlMidia → { id, expiresAt }
// media_id da Meta expira em 30 dias — usamos TTL de 25 dias para segurança
const _mediaIdCache = new Map<string, { id: string; expiresAt: number }>()

async function uploadAudioParaMeta(urlMidia: string, token: string, phoneNumberId: string): Promise<string> {
  const cached = _mediaIdCache.get(urlMidia)
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[WhatsApp] media_id cache hit: ${urlMidia.slice(-30)}`)
    return cached.id
  }

  const mimeType = urlMidia.toLowerCase().includes('.mp3') ? 'audio/mpeg' : 'audio/ogg'
  const ext = mimeType === 'audio/mpeg' ? 'mp3' : 'ogg'

  // Baixa o arquivo do R2
  const audioRes = await fetch(urlMidia)
  if (!audioRes.ok) throw new Error(`Falha ao baixar áudio: ${audioRes.status}`)
  const buffer = await audioRes.arrayBuffer()

  // Faz upload para Meta via multipart
  const formData = new FormData()
  formData.append('messaging_product', 'whatsapp')
  formData.append('type', mimeType)
  formData.append('file', new Blob([buffer], { type: mimeType }), `audio.${ext}`)

  const uploadRes = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    throw new Error(`Meta media upload ${uploadRes.status}: ${err}`)
  }

  const data = await uploadRes.json() as { id: string }
  const mediaId = data.id
  _mediaIdCache.set(urlMidia, { id: mediaId, expiresAt: Date.now() + 25 * 24 * 60 * 60 * 1000 })
  console.log(`[WhatsApp] Áudio uploadado para Meta: media_id=${mediaId}`)
  return mediaId
}

export async function enviarMidiaWhatsApp(
  telefone: string,
  tipo: string,
  urlMidia: string,
  caption?: string,
  creds?: WhatsAppCreds
): Promise<string | null> {
  const { phoneNumberId, token } = resolverCreds(creds)
  const numeroLimpo = telefone.replace(/[\s+\-]/g, '')

  const tipoWA: Record<string, string> = {
    imagem: 'image', documento: 'document', audio: 'audio', video: 'video',
  }
  const waType = tipoWA[tipo] ?? 'document'

  let midiaPayload: Record<string, unknown>
  if (waType === 'audio') {
    // Áudio: upload para Meta → media_id + voice:true = voice note nativo
    const mediaId = await uploadAudioParaMeta(urlMidia, token, phoneNumberId)
    midiaPayload = { id: mediaId, voice: true }
  } else {
    midiaPayload = { link: urlMidia }
    if (caption?.trim()) midiaPayload.caption = caption.trim()
  }

  const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numeroLimpo,
      type: waType,
      [waType]: midiaPayload,
    })
  })

  if (!res.ok) {
    const corpo = await res.text()
    throw new Error(`WhatsApp API ${res.status}: ${corpo}`)
  }

  const data = await res.json() as { messages?: { id: string }[] }
  const waId: string | null = data?.messages?.[0]?.id ?? null
  console.log(`[WhatsApp] Mídia (${tipo}) enviada para ${numeroLimpo} (id: ${waId})`)
  return waId
}
