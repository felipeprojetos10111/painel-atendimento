import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// PATCH /api/operadores/[id] — ativar/desativar, trocar nível ou redefinir senha
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const data: Record<string, unknown> = {}

    if (body.ativo !== undefined)  data.ativo = body.ativo
    if (body.nivel !== undefined)  data.nivel = body.nivel
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
    const { id } = await params

    await prisma.operadores.delete({ where: { id: Number(id) } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/operadores]', err)
    return NextResponse.json({ erro: 'Erro ao deletar operador.' }, { status: 500 })
  }
}
