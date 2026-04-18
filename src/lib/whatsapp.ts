export async function enviarMensagemWhatsApp(telefone: string, texto: string): Promise<string | null> {
  const phoneNumberId = process.env.PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN

  if (!phoneNumberId || !token) {
    throw new Error('PHONE_NUMBER_ID ou WHATSAPP_TOKEN não configurados')
  }

  const numeroLimpo = telefone.replace(/[\s+\-]/g, '')
  console.log(`[WhatsApp] Enviando para: "${numeroLimpo}" (original: "${telefone}")`)

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
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
  console.log(`[WhatsApp] Mensagem enviada com sucesso para ${numeroLimpo} (id: ${waId})`)
  return waId
}

export async function enviarMidiaWhatsApp(
  telefone: string,
  tipo: string,
  urlMidia: string,
  nomeArquivo?: string
): Promise<string | null> {
  const phoneNumberId = process.env.PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN

  if (!phoneNumberId || !token) {
    throw new Error('PHONE_NUMBER_ID ou WHATSAPP_TOKEN não configurados')
  }

  const numeroLimpo = telefone.replace(/[\s+\-]/g, '')

  const tipoWA: Record<string, string> = {
    imagem:    'image',
    documento: 'document',
    audio:     'audio',
    video:     'video',
  }
  const waType = tipoWA[tipo] ?? 'document'

  const midiaPayload: Record<string, unknown> = { link: urlMidia }
  if (waType === 'document' && nomeArquivo) midiaPayload.filename = nomeArquivo

  const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
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

  const data = await res.json()
  const waId: string | null = data?.messages?.[0]?.id ?? null
  console.log(`[WhatsApp] Mídia (${tipo}) enviada para ${numeroLimpo} (id: ${waId})`)
  return waId
}
