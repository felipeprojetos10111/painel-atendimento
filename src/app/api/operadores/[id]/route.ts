import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

async function getPayload() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

// PATCH /api/operadores/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })
    if (payload.nivel !== 'supervisor') {
      return NextResponse.json({ erro: 'Apenas supervisores podem editar operadores.' }, { status: 403 })
    }

    const { id } = await params

    const existe = await prisma.operadores.findFirst({
      where: { id: Number(id), cliente_id: payload.cliente_id }
    })
    if (!existe) return NextResponse.json({ erro: 'Operador não encontrado.' }, { status: 404 })

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.ativo !== undefined) data.ativo = body.ativo
    if (body.nivel !== undefined) data.nivel = body.nivel
    if (body.senha) data.senha_hash = await bcrypt.hash(body.senha, 10)

    const operador = await prisma.operadores.update({
      where: { id: Number(id) },
      data,
      select: { id: true, nome: true, email: true, nivel: true, ativo: true, criado_em: true }
    })

    return NextResponse.json(operador)
  } catch (err) {
    console.error('[PATCH /api/operadores]', err)
    return NextResponse.json({ erro: 'Erro ao atualizar operador.' }, { status: 500 })
  }
}

// DELETE /api/operadores/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })
    if (payload.nivel !== 'supervisor') {
      return NextResponse.json({ erro: 'Apenas supervisores podem remover operadores.' }, { status: 403 })
    }

    const { id } = await params

    const existe = await prisma.operadores.findFirst({
      where: { id: Number(id), cliente_id: payload.cliente_id }
    })
    if (!existe) return NextResponse.json({ erro: 'Operador não encontrado.' }, { status: 404 })

    await prisma.operadores.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/operadores]', err)
    return NextResponse.json({ erro: 'Erro ao deletar operador.' }, { status: 500 })
  }
}
