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
// Supervisor: pode alterar ativo, nivel, senha, na_fila de qualquer operador do cliente.
// Operador: pode alterar apenas o próprio na_fila.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

    const { id } = await params
    const numId = Number(id)
    const ehSupervisor = payload.nivel === 'supervisor'
    const ehProprioOperador = payload.id === numId

    // Operadores comuns só podem editar a si mesmos
    if (!ehSupervisor && !ehProprioOperador) {
      return NextResponse.json({ erro: 'Sem permissão para editar este operador.' }, { status: 403 })
    }

    const existe = await prisma.operadores.findFirst({
      where: { id: numId, cliente_id: payload.cliente_id }
    })
    if (!existe) return NextResponse.json({ erro: 'Operador não encontrado.' }, { status: 404 })

    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (ehSupervisor) {
      if (body.ativo !== undefined) data.ativo = body.ativo
      if (body.nivel !== undefined) data.nivel = body.nivel
      if (body.senha) data.senha_hash = await bcrypt.hash(body.senha, 10)
    }

    // na_fila: supervisor pode alterar qualquer um; operador pode alterar a própria
    if (body.na_fila !== undefined) data.na_fila = body.na_fila

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ erro: 'Nenhum campo válido para atualizar.' }, { status: 400 })
    }

    const operador = await prisma.operadores.update({
      where: { id: numId },
      data,
      select: { id: true, nome: true, email: true, nivel: true, ativo: true, na_fila: true, criado_em: true }
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

    // Desvincula conversas antes de deletar (evita foreign key constraint)
    // Conversas ativas voltam para aguardando_humano para serem reatribuídas
    await prisma.conversas.updateMany({
      where: { operador_id: Number(id), status: { in: ['em_atendimento', 'aguardando_humano'] } },
      data: { operador_id: null, status: 'aguardando_humano' }
    })
    // Demais conversas só zeram o operador_id
    await prisma.conversas.updateMany({
      where: { operador_id: Number(id) },
      data: { operador_id: null }
    })

    await prisma.operadores.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/operadores]', err)
    return NextResponse.json({ erro: 'Erro ao deletar operador.' }, { status: 500 })
  }
}
