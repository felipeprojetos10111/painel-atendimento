import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const IDIOMA_COMPLETO: Record<string, string> = {
  pt: 'Português (Brasil)',
  en: 'Inglês',
  es: 'Espanhol',
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })

    const { ids, idioma } = await req.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ erro: 'ids deve ser um array não vazio.' }, { status: 400 })
    }

    if (!['pt', 'en', 'es'].includes(idioma)) {
      return NextResponse.json({ erro: 'Idioma inválido. Use: pt, en ou es.' }, { status: 400 })
    }

    // Busca mensagens do lead ainda não traduzidas para este idioma.
    // IMPORTANTE: usar OR explícito para incluir linhas com traducao_idioma NULL,
    // pois NOT(NULL = 'pt') = NULL (falso) no SQL — o que excluiria mensagens sem tradução.
    const mensagens = await prisma.mensagens.findMany({
      where: {
        id:      { in: ids.map(Number) },
        origem:  'lead',
        tipo:    { in: ['texto', 'audio'] },
        conteudo: { not: '' },
        OR: [
          { traducao_idioma: null },
          { traducao_idioma: { not: idioma } },
        ],
      },
      select: { id: true, conteudo: true },
    })

    if (mensagens.length === 0) {
      return NextResponse.json({ ok: true, traduzidas: 0 })
    }

    const idiomaCompleto = IDIOMA_COMPLETO[idioma]
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = `Você é um especialista em tradução de mensagens de clientes em atendimento comercial.

CONTEXTO: Você recebe mensagens escritas por leads (clientes em potencial) que frequentemente:
- Cometem erros de ortografia e gramática
- Escrevem de forma incompleta ou telegráfica
- Usam gírias, abreviações ou expressões coloquiais
- Misturam palavras de outros idiomas

SUA TAREFA:
1. Traduza a mensagem para ${idiomaCompleto} de forma clara e natural
2. Interprete erros de ortografia óbvios para entender o que o lead quis dizer
3. Preserve SEMPRE nomes próprios, marcas, apps, plataformas e métodos de pagamento exatamente como escritos pelo lead — NUNCA os substitua por equivalentes locais ou similares

REGRA CRÍTICA — NOMES PRÓPRIOS E REFERÊNCIAS ESPECÍFICAS:
- Nomes de plataformas (Binance, WhatsApp, Instagram, etc.) → manter idênticos
- Métodos de pagamento (Nequi, Pix, Zelle, Daviplata, etc.) → manter idênticos, NUNCA substituir por outro método
- Nomes de pessoas, empresas, cidades → manter idênticos
- Se o lead menciona "Nequi", a tradução deve conter "Nequi", não "Pix" ou qualquer outro

REGRAS GERAIS:
- Retorne APENAS o texto traduzido, sem explicações, sem aspas, sem prefixos
- Nunca adicione informações que não estavam na mensagem original
- Mantenha o tom da mensagem (urgente, dúvida, confirmação, etc.)`

    const resultados = await Promise.all(
      mensagens.map(async (msg) => {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 512,
            system: systemPrompt,
            messages: [{ role: 'user', content: msg.conteudo }],
          })

          const traducao = response.content
            .filter((c) => c.type === 'text')
            .map((c) => (c as { type: 'text'; text: string }).text)
            .join('')
            .trim()

          await prisma.mensagens.update({
            where: { id: msg.id },
            data: { traducao, traducao_idioma: idioma },
          })

          return { id: msg.id, ok: true }
        } catch (err) {
          console.error(`[traduzir] Erro ao traduzir mensagem ${msg.id}:`, err)
          return { id: msg.id, ok: false }
        }
      })
    )

    const traduzidas = resultados.filter((r) => r.ok).length

    return NextResponse.json({ ok: true, traduzidas })
  } catch (err) {
    console.error('[POST /api/mensagens/traduzir]', err)
    return NextResponse.json({ erro: 'Erro interno ao traduzir mensagens.' }, { status: 500 })
  }
}
