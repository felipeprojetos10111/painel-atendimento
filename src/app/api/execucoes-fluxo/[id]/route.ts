import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function verificar(clienteId: number | null | undefined, execucaoId: number) {
  return await prisma.execucoes_fluxo.findFirst({
    where: { id: execucaoId, cliente_id: clienteId ?? -1 },
    include: { eventos: { orderBy: { criado_em: 'asc' } } }
  })
}

// GET /api/execucoes-fluxo/[id] — detalhe + eventos
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })
  const payload = await verifyToken(token)
  if (!payload || (payload.nivel !== 'supervisor' && payload.nivel !== 'super_admin'))
    return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const execucao = await verificar(payload.cliente_id, Number(id))
  if (!execucao) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(execucao)
}

// PATCH /api/execucoes-fluxo/[id] — pausar / retomar / finalizar
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })
  const payload = await verifyToken(token)
  if (!payload || (payload.nivel !== 'supervisor' && payload.nivel !== 'super_admin'))
    return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const execucao = await prisma.execucoes_fluxo.findFirst({
    where: { id: Number(id), cliente_id: payload.cliente_id ?? -1 }
  })
  if (!execucao) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })

  const { acao } = await req.json()
  const statusMap: Record<string, string> = {
    pausar: 'pausada_humano',
    retomar: 'aguardando_lead',
    finalizar: 'finalizada_perdida',
  }
  const novoStatus = statusMap[acao]
  if (!novoStatus) return NextResponse.json({ erro: 'Ação inválida. Use: pausar | retomar | finalizar' }, { status: 400 })

  const atualizado = await prisma.execucoes_fluxo.update({
    where: { id: Number(id) },
    data: {
      status: novoStatus,
      ...(acao === 'finalizar' ? { finalizada_em: new Date(), proxima_acao_em: null } : {}),
      atualizada_em: new Date()
    }
  })

  await prisma.eventos_fluxo.create({
    data: {
      execucao_id: execucao.id,
      cliente_id: execucao.cliente_id,
      tipo: acao === 'pausar' ? 'pausado' : acao === 'retomar' ? 'retomado' : 'finalizado',
      estagio: execucao.estagio_atual,
      payload: { por: payload.nome, acao }
    }
  })

  return NextResponse.json(atualizado)
}
