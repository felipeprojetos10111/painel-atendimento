import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function verificarAcesso() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || (payload.nivel !== 'supervisor' && payload.nivel !== 'super_admin')) return null
  return payload
}

// GET /api/fluxos — lista fluxos do cliente
export async function GET() {
  const payload = await verificarAcesso()
  if (!payload) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const fluxos = await prisma.fluxos.findMany({
    where: { cliente_id: payload.cliente_id ?? undefined },
    orderBy: [{ is_padrao: 'desc' }, { ativo: 'desc' }, { criado_em: 'desc' }],
    select: {
      id: true, nome: true, descricao: true, versao: true,
      ativo: true, is_padrao: true,
      reengajamento_horas: true, reengajamento_max_tentativas: true,
      criado_em: true, atualizado_em: true,
      _count: { select: { execucoes: true } }
    }
  })

  return NextResponse.json(fluxos)
}

// POST /api/fluxos — cria novo fluxo
export async function POST(req: NextRequest) {
  const payload = await verificarAcesso()
  if (!payload) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const body = await req.json()
  const { nome, descricao, definicao, reengajamento_horas, reengajamento_max_tentativas } = body

  if (!nome) return NextResponse.json({ erro: 'nome obrigatório' }, { status: 400 })
  if (!definicao?.estagio_inicial || !definicao?.estagios)
    return NextResponse.json({ erro: 'definicao deve ter estagio_inicial e estagios' }, { status: 400 })

  const fluxo = await prisma.fluxos.create({
    data: {
      cliente_id: payload.cliente_id,
      nome,
      descricao: descricao ?? null,
      definicao,
      reengajamento_horas: reengajamento_horas ?? 24,
      reengajamento_max_tentativas: reengajamento_max_tentativas ?? 2,
      ativo: false,
      is_padrao: false,
    }
  })

  return NextResponse.json(fluxo, { status: 201 })
}
