import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

const TOOLS = [
  {
    name: 'responder_lead',
    description: 'Envia uma resposta ao lead resolvendo sua dúvida ou demanda. Use quando conseguir ajudar completamente sem precisar de um humano.',
    input_schema: {
      type: 'object',
      properties: {
        mensagem: {
          type: 'string',
          description: 'Mensagem clara e completa para enviar ao lead via WhatsApp'
        }
      },
      required: ['mensagem']
    }
  },
  {
    name: 'solicitar_informacao',
    description: 'Faz uma pergunta ao lead para coletar informações necessárias antes de responder ou tomar uma decisão. Use quando precisar de dados adicionais.',
    input_schema: {
      type: 'object',
      properties: {
        pergunta: {
          type: 'string',
          description: 'Pergunta objetiva e direta para o lead'
        }
      },
      required: ['pergunta']
    }
  },
  {
    name: 'escalar_humano',
    description: 'Transfere a conversa para um operador humano. Use quando: o lead pedir para falar com humano, a situação envolver pagamento/reclamação/problema urgente, ou quando não conseguir resolver com as informações disponíveis.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          description: 'Resumo do motivo da escalação para o operador humano'
        },
        urgencia: {
          type: 'string',
          enum: ['baixa', 'media', 'alta'],
          description: 'baixa: dúvida simples | media: interesse em comprar ou avançar | alta: problema urgente, reclamação ou pedido explícito de humano'
        }
      },
      required: ['motivo', 'urgencia']
    }
  }
]

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload || payload.nivel !== 'supervisor') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { mensagem, prompt_sistema, modelo } = await req.json()

  if (!mensagem?.trim()) return NextResponse.json({ error: 'Mensagem é obrigatória.' }, { status: 400 })
  if (!prompt_sistema?.trim()) return NextResponse.json({ error: 'Prompt é obrigatório.' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 500 })

  // Monta prompt final igual ao que a IA usaria em produção
  const systemPrompt = prompt_sistema.trim() +
    `\n\n--- CONTEXTO ---` +
    `\nLead: (teste)` +
    `\nPrimeira mensagem deste lead.` +
    `\nRodadas restantes antes de escalar obrigatoriamente: 5` +
    `\n\nVocê DEVE usar uma das ferramentas (tools) disponíveis. Nunca responda em texto livre.`

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
      tools: TOOLS,
      tool_choice: { type: 'any' },
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    return NextResponse.json({ error: `Anthropic API: ${err}` }, { status: 502 })
  }

  const data = await resp.json()
  const toolUse = data.content?.find((c: { type: string }) => c.type === 'tool_use')

  if (!toolUse) {
    return NextResponse.json({ error: 'IA não chamou nenhuma tool — resposta inesperada.', raw: data }, { status: 422 })
  }

  const decisao = { acao: toolUse.name, ...toolUse.input }
  return NextResponse.json({ ok: true, decisao, promptFinal: systemPrompt })
}
