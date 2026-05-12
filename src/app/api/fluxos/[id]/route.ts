import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function verificarAcesso(clienteId?: number | null) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || (payload.nivel !== 'supervisor' && payload.nivel !== 'super_admin')) return null
  return payload
}

// GET /api/fluxos/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await verificarAcesso()
  if (!payload) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const fluxo = await prisma.fluxos.findFirst({
    where: { id: Number(id), cliente_id: payload.cliente_id ?? undefined }
  })
  if (!fluxo) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(fluxo)
}

// PUT /api/fluxos/[id] — atualiza (incrementa versão)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await verificarAcesso()
  if (!payload) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const fluxoAtual = await prisma.fluxos.findFirst({
    where: { id: Number(id), cliente_id: payload.cliente_id ?? undefined }
  })
  if (!fluxoAtual) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })

  const body = await req.json()
  const data: Record<string, unknown> = { atualizado_em: new Date() }

  if (body.nome !== undefined) data.nome = body.nome
  if (body.descricao !== undefined) data.descricao = body.descricao ?? null
  if (body.reengajamento_horas !== undefined) data.reengajamento_horas = body.reengajamento_horas
  if (body.reengajamento_max_tentativas !== undefined) data.reengajamento_max_tentativas = body.reengajamento_max_tentativas
  if (body.definicao !== undefined) {
    if (!body.definicao?.estagio_inicial || !body.definicao?.estagios)
      return NextResponse.json({ erro: 'definicao inválida' }, { status: 400 })
    data.definicao = body.definicao
    data.versao = fluxoAtual.versao + 1 // incrementa versão ao editar definição
  }

  const fluxo = await prisma.fluxos.update({ where: { id: Number(id) }, data })
  return NextResponse.json(fluxo)
}

// DELETE /api/fluxos/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await verificarAcesso()
  if (!payload) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const fluxo = await prisma.fluxos.findFirst({
    where: { id: Number(id), cliente_id: payload.cliente_id ?? undefined }
  })
  if (!fluxo) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })

  // Não permite deletar se tiver execuções ativas
  const ativas = await prisma.execucoes_fluxo.count({
    where: { fluxo_id: Number(id), status: { in: ['ativa', 'aguardando_lead', 'reengajando'] } }
  })
  if (ativas > 0)
    return NextResponse.json({ erro: `Fluxo tem ${ativas} execuções ativas. Desative antes de deletar.` }, { status: 409 })

  await prisma.fluxos.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
