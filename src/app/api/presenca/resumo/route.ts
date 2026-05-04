import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const inicio     = searchParams.get('inicio')
  const fim        = searchParams.get('fim')
  const opIdParam  = searchParams.get('operador_id')
  const operadorId = opIdParam ? parseInt(opIdParam) : null

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dataInicio = inicio ? new Date(inicio + 'T00:00:00') : hoje
  const dataFim    = fim    ? new Date(fim    + 'T23:59:59') : new Date()

  // Busca sessões cujo início cai no período (inclui sessões ainda abertas)
  const sessoes = await prisma.sessoes_presenca.findMany({
    where: {
      cliente_id:  payload.cliente_id,
      inicio:      { gte: dataInicio, lte: dataFim },
      ...(operadorId ? { operador_id: operadorId } : {}),
    },
    select: { status: true, inicio: true, fim: true, duracao_min: true },
  })

  let ativo_min   = 0
  let standby_min = 0

  for (const s of sessoes) {
    // Se a sessão ainda está aberta, calcula duração parcial até agora
    const duracao = s.duracao_min
      ?? Math.max(1, Math.round((new Date().getTime() - s.inicio.getTime()) / 60000))

    if (s.status === 'ativo')   ativo_min   += duracao
    if (s.status === 'standby') standby_min += duracao
  }

  const total = ativo_min + standby_min
  const aproveitamento = total > 0 ? Math.round((ativo_min / total) * 100) : null

  return NextResponse.json({ ativo_min, standby_min, aproveitamento })
}
