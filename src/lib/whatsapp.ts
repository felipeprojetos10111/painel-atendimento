import { spawnSync } from 'child_process'

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

/**
 * Converte qualquer áudio (WebM, MP3, WAV, etc.) para OGG/Opus via FFmpeg.
 * WhatsApp Business API exige OGG/Opus para voice notes (voice: true).
 * Sem conversão, arquivos WebM (gravados pelo browser Chrome) chegam como
 * documentos e disparam o aviso "verificar email" no WhatsApp do lead.
 */
function converterParaOggOpus(inputBuffer: Buffer): Buffer | null {
  try {
    const result = spawnSync(
      'ffmpeg',
      [
        '-i', 'pipe:0',
        '-c:a', 'libopus',
        '-b:a', '32k',
        '-ar', '16000',
        '-ac', '1',
        '-f', 'ogg',
        '-loglevel', 'error',
        'pipe:1',
      ],
      { input: inputBuffer, maxBuffer: 50 * 1024 * 1024 }
    )

    if (result.status === 0 && result.stdout && result.stdout.length > 0) {
      console.log(`[WhatsApp] FFmpeg: OGG/Opus gerado (${(result.stdout.length / 1024).toFixed(0)} KB)`)
      return result.stdout as Buffer
    }

    const stderr = result.stderr?.toString() ?? ''
    console.warn('[WhatsApp] FFmpeg saiu com erro:', stderr.slice(0, 300))
    return null
  } catch (e) {
    console.warn('[WhatsApp] FFmpeg não disponível:', e)
    return null
  }
}

async function uploadAudioParaMeta(urlMidia: string, token: string, phoneNumberId: string): Promise<string> {
  const cached = _mediaIdCache.get(urlMidia)
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[WhatsApp] media_id cache hit: ${urlMidia.slice(-30)}`)
    return cached.id
  }

  // Baixa o arquivo do R2
  const audioRes = await fetch(urlMidia)
  if (!audioRes.ok) throw new Error(`Falha ao baixar áudio: ${audioRes.status}`)
  const rawBuffer = Buffer.from(await audioRes.arrayBuffer())

  // Sempre converte para OGG/Opus — garante compatibilidade com voice:true
  // WebM (Chrome), WAV, MP3 etc. precisam virar OGG/Opus senão chegam como documento
  const oggBuffer = converterParaOggOpus(rawBuffer)
  const finalBuffer = oggBuffer ?? rawBuffer
  const mimeType    = oggBuffer ? 'audio/ogg' : (urlMidia.toLowerCase().includes('.mp3') ? 'audio/mpeg' : 'audio/ogg')
  const ext         = mimeType === 'audio/mpeg' ? 'mp3' : 'ogg'

  // Faz upload para Meta via multipart
  const formData = new FormData()
  formData.append('messaging_product', 'whatsapp')
  formData.append('type', mimeType)
  formData.append('file', new Blob([new Uint8Array(finalBuffer)], { type: mimeType }), `audio.${ext}`)

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

async function estimarDelayAudio(urlMidia: string): Promise<number> {
  try {
    const head = await fetch(urlMidia, { method: 'HEAD' })
    const bytes = parseInt(head.headers.get('content-length') ?? '0')
    if (bytes > 0) {
      const duracaoEstimada = bytes / 3000 // 24kbps ≈ 3000 bytes/s
      return Math.min(Math.max((duracaoEstimada + 0.5) * 1000, 1500), 8000)
    }
  } catch { /* usa fallback */ }
  return 2000
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

  // Delay proporcional à duração estimada do áudio; fixo para outras mídias
  const delayMs = waType === 'audio' ? await estimarDelayAudio(urlMidia) : 1200
  await new Promise(r => setTimeout(r, delayMs))

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
