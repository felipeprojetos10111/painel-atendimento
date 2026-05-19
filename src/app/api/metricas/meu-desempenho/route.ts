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

  // Busca conversas atendidas no período por este operador
  const conversasAtendidas = await prisma.conversas.findMany({
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
  })

  // Leads únicos atendidos
  const leadsAtendidos = new Set(conversasAtendidas.map(c => c.lead_id).filter(Boolean)).size

  // Lead IDs do funil — filtra eventos do broker apenas por leads que passaram pelo nosso funil.
  // eventos_plataforma com lead_id=null são registros orgânicos externos e não devem contar.
  const leadIdsFunil = conversasAtendidas.map(c => c.lead_id).filter(Boolean) as number[]

  // Se não há leads no funil no período, retorna zeros para eventos
  if (leadIdsFunil.length === 0) {
    return NextResponse.json({
      periodo,
      leadsAtendidos: 0,
      registros:      0,
      ftd:            0,
      redepositos:    0,
      totalValorFTD:         0,
      totalValorRedepositos: 0,
    })
  }

  const eventosFiltro = {
    cliente_id:  clienteId,
    data_evento: { gte: dataInicio, lte: agora },
    lead_id:     { in: leadIdsFunil },
  }

  const [eventosRegistro, eventosDeposito] = await Promise.all([
    prisma.eventos_plataforma.findMany({
      where:  { ...eventosFiltro, tipo: 'registro' },
      select: { id: true },
    }),
    prisma.eventos_plataforma.findMany({
      where:  { ...eventosFiltro, tipo: 'deposito' },
      select: { id: true, is_primeiro_deposito: true, valor: true },
    }),
  ])

  const ftd         = eventosDeposito.filter(e => e.is_primeiro_deposito === true)
  const redepositos = eventosDeposito.filter(e => e.is_primeiro_deposito !== true)

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
