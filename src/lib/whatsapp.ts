export async function enviarMensagemWhatsApp(telefone: string, texto: string): Promise<void> {
  const url = `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
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
    const erro = await res.text()
    throw new Error(`WhatsApp API erro ${res.status}: ${erro}`)
  }
}
