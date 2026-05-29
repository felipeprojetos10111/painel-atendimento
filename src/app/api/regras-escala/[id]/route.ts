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

// PATCH /api/regras-escala/[id] — edita mensagem_referencia, operador_id ou ativo
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })
  if (payload.nivel !== 'supervisor') return NextResponse.json({ erro: 'Apenas supervisores podem editar regras.' }, { status: 403 })

  const { id } = await params

  const regra = await prisma.regras_escala.findFirst({
    where: { id: Number(id), cliente_id: payload.cliente_id }
  })
  if (!regra) return NextResponse.json({ erro: 'Regra não encontrada.' }, { status: 404 })

  const body = await req.json()
  const data: Record<string, unknown> = {}

  if (body.ativo !== undefined) data.ativo = body.ativo
  if (body.mensagem_referencia?.trim()) data.mensagem_referencia = body.mensagem_referencia.trim()
  if (body.operador_id !== undefined) {
    const op = await prisma.operadores.findFirst({
      where: { id: Number(body.operador_id), cliente_id: payload.cliente_id }
    })
    if (!op) return NextResponse.json({ erro: 'Operador não encontrado.' }, { status: 404 })
    data.operador_id = Number(body.operador_id)
  }

  const atualizada = await prisma.regras_escala.update({
    where: { id: Number(id) },
    data,
    include: { operadores: { select: { id: true, nome: true } } }
  })

  return NextResponse.json(atualizada)
}

// DELETE /api/regras-escala/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })
  if (payload.nivel !== 'supervisor') return NextResponse.json({ erro: 'Apenas supervisores podem remover regras.' }, { status: 403 })

  const { id } = await params

  const regra = await prisma.regras_escala.findFirst({
    where: { id: Number(id), cliente_id: payload.cliente_id }
  })
  if (!regra) return NextResponse.json({ erro: 'Regra não encontrada.' }, { status: 404 })

  await prisma.regras_escala.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
