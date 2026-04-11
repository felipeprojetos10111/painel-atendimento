import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/respostas-rapidas?categoria=X&atalho=X&tipo=X
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const categoria = searchParams.get('categoria')
  const atalho = searchParams.get('atalho')
  const tipo = searchParams.get('tipo')

  const respostas = await prisma.respostas_rapidas.findMany({
    where: {
      ativo: true,
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
  const body = await req.json()
  const { titulo, tipo, conteudo, url_midia, categoria, atalho } = body

  if (!titulo) {
    return NextResponse.json({ erro: 'O campo título é obrigatório.' }, { status: 400 })
  }

  const tiposValidos = ['texto', 'imagem', 'audio', 'video', 'documento']
  if (tipo && !tiposValidos.includes(tipo)) {
    return NextResponse.json({ erro: `Tipo inválido. Use: ${tiposValidos.join(', ')}` }, { status: 400 })
  }

  if (tipo !== 'texto' && !url_midia) {
    return NextResponse.json({ erro: 'url_midia é obrigatório para mídias.' }, { status: 400 })
  }

  const resposta = await prisma.respostas_rapidas.create({
    data: {
      titulo,
      tipo: tipo ?? 'texto',
      conteudo: conteudo ?? null,
      url_midia: url_midia ?? null,
      categoria: categoria ?? null,
      atalho: atalho ?? null
    }
  })

  return NextResponse.json(resposta, { status: 201 })
}
