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

// GET /api/regras-escala — lista todas as regras do cliente
export async function GET(_req: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const regras = await prisma.regras_escala.findMany({
    where: { cliente_id: payload.cliente_id },
    include: {
      operadores: { select: { id: true, nome: true } }
    },
    orderBy: { criado_em: 'asc' }
  })

  return NextResponse.json(regras)
}

// POST /api/regras-escala — cria nova regra (supervisor only)
export async function POST(req: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })
  if (payload.nivel !== 'supervisor') return NextResponse.json({ erro: 'Apenas supervisores podem criar regras.' }, { status: 403 })

  const body = await req.json()
  const { mensagem_referencia, operador_id } = body

  if (!mensagem_referencia?.trim()) return NextResponse.json({ erro: 'Mensagem de referência é obrigatória.' }, { status: 400 })
  if (!operador_id) return NextResponse.json({ erro: 'Operador é obrigatório.' }, { status: 400 })

  // Verifica se operador pertence ao cliente
  const operador = await prisma.operadores.findFirst({
    where: { id: Number(operador_id), cliente_id: payload.cliente_id }
  })
  if (!operador) return NextResponse.json({ erro: 'Operador não encontrado.' }, { status: 404 })

  const regra = await prisma.regras_escala.create({
    data: {
      cliente_id: payload.cliente_id,
      mensagem_referencia: mensagem_referencia.trim(),
      operador_id: Number(operador_id),
      ativo: true,
    },
    include: { operadores: { select: { id: true, nome: true } } }
  })

  return NextResponse.json(regra, { status: 201 })
}
