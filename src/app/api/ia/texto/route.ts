import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPTS = {
  melhorar: `Você é um revisor de texto. Sua única função é reescrever a mensagem que o operador digitou, melhorando a escrita.

CONTEXTO: Um operador de atendimento ao cliente digitou uma mensagem que será enviada a um lead/cliente. Você deve melhorar ESSA mensagem — não responder a ela, não interpretá-la como pergunta para você.

REGRAS OBRIGATÓRIAS:
1. Reescreva a mensagem corrigindo erros ortográficos e gramaticais
2. Torne o texto mais claro, fluido e fácil de entender
3. Preserve EXATAMENTE o mesmo sentido, intenção e informações do original
4. Mantenha o mesmo idioma do texto original
5. Mantenha o tom (formal ou informal) do original
6. NÃO adicione informações novas
7. NÃO responda ao conteúdo da mensagem — apenas melhore a escrita dela
8. Retorne SOMENTE o texto melhorado, sem explicações, sem aspas, sem comentários`,

  traduzir: (idioma: string) => `Você é um tradutor. Sua ÚNICA função é traduzir o texto fornecido para ${idioma}.

REGRAS OBRIGATÓRIAS:
1. Traduza EXATAMENTE o texto recebido — não responda a ele, não o interprete como pergunta para você
2. Se o texto for uma pergunta ou pedido direcionado a alguém, traduza essa pergunta/pedido fielmente
3. Preserve o sentido, tom e intenção do original
4. Adapte expressões idiomáticas naturalmente para o idioma de destino
5. Retorne SOMENTE o texto traduzido, sem explicações, sem aspas, sem prefixos, sem comentários
6. NUNCA gere uma resposta ao conteúdo — apenas traduza`,
}

const IDIOMAS: Record<string, string> = {
  pt: 'Português (Brasil)',
  en: 'Inglês',
  es: 'Espanhol',
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const payload = token ? await verifyToken(token) : null
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { texto, acao, idioma } = await req.json() as {
    texto: string
    acao: 'melhorar' | 'traduzir'
    idioma?: string
  }

  if (!texto?.trim()) return NextResponse.json({ erro: 'Texto obrigatório' }, { status: 400 })
  if (!['melhorar', 'traduzir'].includes(acao)) return NextResponse.json({ erro: 'Ação inválida' }, { status: 400 })
  if (acao === 'traduzir' && !IDIOMAS[idioma ?? '']) {
    return NextResponse.json({ erro: 'Idioma inválido' }, { status: 400 })
  }

  const systemPrompt = acao === 'melhorar'
    ? PROMPTS.melhorar
    : PROMPTS.traduzir(IDIOMAS[idioma!])

  const msg = await client.messages.create({
    model:      'claude-haiku-4-5',
    max_tokens: 1024,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: texto.trim() }],
  })

  const resultado = msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  return NextResponse.json({ resultado })
}
