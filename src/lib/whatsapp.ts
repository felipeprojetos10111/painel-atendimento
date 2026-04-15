export async function enviarMensagemWhatsApp(telefone: string, texto: string): Promise<void> {
  const phoneNumberId = process.env.PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_TOKEN

  if (!phoneNumberId || !token) {
    throw new Error('PHONE_NUMBER_ID ou WHATSAPP_TOKEN não configurados')
  }

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefone,
      type: 'text',
      text: { body: texto }
    })
  })

  if (!res.ok) {
    const corpo = await res.text()
    throw new Error(`WhatsApp API ${res.status}: ${corpo}`)
  }

  console.log(`[WhatsApp] Mensagem enviada para ${telefone}`)
}
