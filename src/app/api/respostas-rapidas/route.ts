import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

async function getPayload() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

// GET /api/respostas-rapidas — respostas do operador logado (inclui itens ordenados)
export async function GET(req: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const categoria = searchParams.get('categoria')
  const atalho    = searchParams.get('atalho')
  const todos     = searchParams.get('todos') === 'true'

  const respostas = await prisma.respostas_rapidas.findMany({
    where: {
      operador_id: payload.id,
      ...(!todos && { ativo: true }),
      ...(categoria && { categoria }),
      ...(atalho    && { atalho: { contains: atalho, mode: 'insensitive' } })
    },
    include: {
      itens: { orderBy: { ordem: 'asc' } }
    },
    orderBy: [{ ordem: 'asc' }, { criado_em: 'desc' }]
  })

  return NextResponse.json(respostas)
}

// POST /api/respostas-rapidas — cria resposta com array de itens
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

    const body = await req.json()
    const { titulo, categoria, atalho, itens } = body

    if (!titulo) return NextResponse.json({ erro: 'O campo título é obrigatório.' }, { status: 400 })
    if (!itens?.length) return NextResponse.json({ erro: 'A resposta precisa ter ao menos 1 item.' }, { status: 400 })

    const tiposValidos = ['texto', 'imagem', 'audio', 'video', 'documento']
    for (const item of itens) {
      if (!tiposValidos.includes(item.tipo)) {
        return NextResponse.json({ erro: `Tipo inválido: ${item.tipo}` }, { status: 400 })
      }
      if (item.tipo !== 'texto' && !item.url_midia) {
        return NextResponse.json({ erro: 'url_midia obrigatório para itens de mídia.' }, { status: 400 })
      }
    }

    const completa = await prisma.$transaction(async (tx) => {
      const resposta = await tx.respostas_rapidas.create({
        data: {
          cliente_id:  payload.cliente_id!,
          operador_id: payload.id,
          titulo,
          categoria: categoria || null,
          atalho:    atalho    || null,
          // campos legados espelham o primeiro item para manter compatibilidade
          tipo:      itens[0].tipo,
          conteudo:  itens[0].conteudo || null,
          url_midia: itens[0].url_midia || null,
        }
      })

      await tx.respostas_rapidas_itens.createMany({
        data: itens.map((item: { tipo: string; conteudo?: string; url_midia?: string; delay_depois?: number }, i: number) => ({
          resposta_id:  resposta.id,
          ordem:        i,
          tipo:         item.tipo,
          conteudo:     item.conteudo    || null,
          url_midia:    item.url_midia   || null,
          delay_depois: Number(item.delay_depois) || 0,
        }))
      })

      return tx.respostas_rapidas.findUnique({
        where: { id: resposta.id },
        include: { itens: { orderBy: { ordem: 'asc' } } }
      })
    })

    return NextResponse.json(completa, { status: 201 })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro interno.'
    if (mensagem.includes('Unique constraint') || mensagem.includes('unique constraint')) {
      return NextResponse.json({ erro: 'Já existe uma resposta com esse atalho.' }, { status: 409 })
    }
    console.error('[POST /api/respostas-rapidas]', err)
    return NextResponse.json({ erro: 'Erro interno ao cadastrar resposta.' }, { status: 500 })
  }
}
