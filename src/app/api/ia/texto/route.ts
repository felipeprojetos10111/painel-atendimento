import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPTS = {
  melhorar: `Você é um assistente especializado em comunicação comercial de alta conversão.
Melhore o texto a seguir seguindo EXATAMENTE estas regras:
1. Corrija erros ortográficos e gramaticais
2. Torne a linguagem mais clara e fácil de entender
3. Melhore a didática sem alterar o sentido original
4. Mantenha o mesmo idioma do texto original
5. Preserve o tom (formal/informal) e o contexto
6. Não adicione informações que não estavam no texto
7. Retorne APENAS o texto melhorado, sem explicações, sem aspas, sem prefixos`,

  traduzir: (idioma: string) => `Traduza o texto a seguir para ${idioma}.
Regras:
1. Traduza fielmente, preservando o sentido e o tom original
2. Adapte expressões idiomáticas naturalmente para o idioma de destino
3. Retorne APENAS o texto traduzido, sem explicações, sem aspas, sem prefixos`,
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
