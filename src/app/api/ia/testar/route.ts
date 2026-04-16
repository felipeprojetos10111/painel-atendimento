import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload || payload.nivel !== 'supervisor') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { mensagem, prompt_sistema, modelo, idioma_resposta, criterios_escalacao } = await req.json()

  if (!mensagem?.trim()) return NextResponse.json({ error: 'Mensagem é obrigatória.' }, { status: 400 })
  if (!prompt_sistema?.trim()) return NextResponse.json({ error: 'Prompt é obrigatório.' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 500 })

  // Monta prompt final igual ao que a IA usaria em produção
  let systemPrompt = prompt_sistema.trim()

  if (Array.isArray(criterios_escalacao) && criterios_escalacao.length > 0) {
    systemPrompt += `\n\nEscale imediatamente (acao: "escalar") se a mensagem envolver: ${criterios_escalacao.join(', ')}.`
  }

  if (idioma_resposta && idioma_resposta !== 'auto') {
    const idiomas: Record<string, string> = { pt: 'português', en: 'inglês', es: 'espanhol' }
    const idioma = idiomas[idioma_resposta]
    if (idioma) systemPrompt += `\n\nResponda SEMPRE em ${idioma}, independente do idioma da mensagem.`
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: modelo || 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: mensagem.trim() }],
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    return NextResponse.json({ error: `Anthropic API: ${err}` }, { status: 502 })
  }

  const data = await resp.json()
  const texto: string = data.content?.[0]?.text ?? ''

  const match = texto.match(/\{[\s\S]*\}/)
  if (!match) {
    return NextResponse.json({ error: 'IA não retornou JSON válido.', raw: texto }, { status: 422 })
  }

  try {
    const decisao = JSON.parse(match[0])
    return NextResponse.json({ ok: true, decisao, promptFinal: systemPrompt })
  } catch {
    return NextResponse.json({ error: 'JSON inválido na resposta da IA.', raw: texto }, { status: 422 })
  }
}
