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

// GET /api/respostas-rapidas
export async function GET(req: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const categoria = searchParams.get('categoria')
  const atalho    = searchParams.get('atalho')
  const tipo      = searchParams.get('tipo')
  const todos     = searchParams.get('todos') === 'true'

  const respostas = await prisma.respostas_rapidas.findMany({
    where: {
      cliente_id: payload.cliente_id,
      ...(!todos && { ativo: true }),
      ...(categoria && { categoria }),
      ...(tipo && { tipo }),
      ...(atalho && { atalho: { contains: atalho, mode: 'insensitive' } })
    },
    orderBy: { criado_em: 'desc' }
  })

  return NextResponse.json(respostas)
}

// POST /api/respostas-rapidas
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const body = await req.json()
    const { titulo, tipo, conteudo, url_midia, categoria, atalho } = body

    if (!titulo) {
      return NextResponse.json({ erro: 'O campo título é obrigatório.' }, { status: 400 })
    }

    const tiposValidos = ['texto', 'imagem', 'audio', 'video', 'documento']
    const tipoFinal = tipo ?? 'texto'

    if (!tiposValidos.includes(tipoFinal)) {
      return NextResponse.json({ erro: `Tipo inválido. Use: ${tiposValidos.join(', ')}` }, { status: 400 })
    }

    if (tipoFinal !== 'texto' && !url_midia) {
      return NextResponse.json({ erro: 'url_midia é obrigatório para mídias.' }, { status: 400 })
    }

    const resposta = await prisma.respostas_rapidas.create({
      data: {
        cliente_id: payload.cliente_id,
        titulo,
        tipo:      tipoFinal,
        conteudo:  conteudo  || null,
        url_midia: url_midia || null,
        categoria: categoria || null,
        atalho:    atalho    || null
      }
    })

    return NextResponse.json(resposta, { status: 201 })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro interno.'
    if (mensagem.includes('Unique constraint') || mensagem.includes('unique constraint')) {
      return NextResponse.json({ erro: 'Já existe uma resposta com esse atalho.' }, { status: 409 })
    }
    console.error('[POST /api/respostas-rapidas]', err)
    return NextResponse.json({ erro: 'Erro interno ao cadastrar resposta.' }, { status: 500 })
  }
}
