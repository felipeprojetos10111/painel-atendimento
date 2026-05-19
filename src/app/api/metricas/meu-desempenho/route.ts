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

  // Operador só vê suas próprias métricas — nunca pode passar outro operador_id
  const operadorId = payload.id
  const clienteId  = payload.cliente_id

  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get('periodo') ?? '7d'

  const agora = new Date()
  let dataInicio: Date

  switch (periodo) {
    case '1d':
      dataInicio = new Date(agora); dataInicio.setHours(0, 0, 0, 0); break
    case '30d':
      dataInicio = new Date(agora); dataInicio.setDate(agora.getDate() - 30); break
    case 'all':
      dataInicio = new Date('2020-01-01'); break
    default: // 7d
      dataInicio = new Date(agora); dataInicio.setDate(agora.getDate() - 7)
  }

  const eventosFiltro = {
    cliente_id:  clienteId,
    // operador_id nos eventos_plataforma chega null da maioria dos webhooks do broker;
    // filtramos apenas por cliente para não perder eventos sem atribuição.
    data_evento: { gte: dataInicio, lte: agora },
  }

  const [eventosRegistro, eventosDeposito, conversasAtendidas] = await Promise.all([
    prisma.eventos_plataforma.findMany({
      where:  { ...eventosFiltro, tipo: 'registro' },
      select: { id: true },
    }),
    prisma.eventos_plataforma.findMany({
      where:  { ...eventosFiltro, tipo: 'deposito' },
      select: { id: true, is_primeiro_deposito: true, valor: true },
    }),
    prisma.conversas.findMany({
      where: {
        cliente_id:  clienteId,
        operador_id: operadorId,
        mensagens: {
          some: {
            origem:     { in: ['operador', 'ia'] },
            enviado_em: { gte: dataInicio, lte: agora },
          },
        },
      },
      select: { lead_id: true },
    }),
  ])

  const ftd        = eventosDeposito.filter(e => e.is_primeiro_deposito === true)
  const redepositos = eventosDeposito.filter(e => e.is_primeiro_deposito !== true)

  // Leads únicos atendidos
  const leadsAtendidos = new Set(conversasAtendidas.map(c => c.lead_id).filter(Boolean)).size

  return NextResponse.json({
    periodo,
    leadsAtendidos,
    registros:   eventosRegistro.length,
    ftd:         ftd.length,
    redepositos: redepositos.length,
    totalValorFTD:         ftd.reduce((s, e) => s + Number(e.valor ?? 0), 0),
    totalValorRedepositos: redepositos.reduce((s, e) => s + Number(e.valor ?? 0), 0),
  })
}
