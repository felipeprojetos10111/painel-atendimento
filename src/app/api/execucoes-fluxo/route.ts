import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/execucoes-fluxo?status=&conversa_id=&limit=
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })
  const payload = await verifyToken(token)
  if (!payload || (payload.nivel !== 'supervisor' && payload.nivel !== 'super_admin'))
    return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const conversaId = searchParams.get('conversa_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  const execucoes = await prisma.execucoes_fluxo.findMany({
    where: {
      cliente_id: payload.cliente_id,
      ...(status ? { status } : {}),
      ...(conversaId ? { conversa_id: Number(conversaId) } : {}),
    },
    orderBy: { atualizada_em: 'desc' },
    take: limit,
    include: {
      fluxos: { select: { id: true, nome: true } },
      conversas: {
        select: {
          id: true,
          leads: { select: { nome: true, telefone: true } }
        }
      },
      _count: { select: { eventos: true } }
    }
  })

  return NextResponse.json(execucoes)
}
