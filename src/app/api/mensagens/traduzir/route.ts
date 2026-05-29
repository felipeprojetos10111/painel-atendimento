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

    // Fetch messages — only translate lead text messages not already translated to this language
    const mensagens = await prisma.mensagens.findMany({
      where: {
        id: { in: ids.map(Number) },
        origem: 'lead',
        tipo: 'texto',
        conteudo: { not: '' },
        NOT: { traducao_idioma: idioma },
      },
      select: { id: true, conteudo: true },
    })

    if (mensagens.length === 0) {
      return NextResponse.json({ ok: true, traduzidas: 0 })
    }

    const idiomaCompleto = IDIOMA_COMPLETO[idioma]
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const resultados = await Promise.all(
      mensagens.map(async (msg) => {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 1024,
            system: `Você é um tradutor. Traduza o texto para ${idiomaCompleto}. Retorne APENAS o texto traduzido, sem explicações, sem aspas.`,
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
