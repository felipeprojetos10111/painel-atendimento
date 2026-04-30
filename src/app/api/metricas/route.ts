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
  const inicio = searchParams.get('inicio')
  const fim    = searchParams.get('fim')

  // Padrão: hoje (00:00 até agora)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dataInicio = inicio ? new Date(inicio + 'T00:00:00') : hoje
  const dataFim    = fim    ? new Date(fim    + 'T23:59:59') : new Date()

  const clienteId = payload.cliente_id

  // ── Leads atendidos no período ────────────────────────────────────────────
  // Conversas com pelo menos 1 mensagem de operador no período
  const conversasAtendidas = await prisma.conversas.findMany({
    where: {
      cliente_id: clienteId,
      mensagens: {
        some: {
          origem:    'operador',
          enviado_em: { gte: dataInicio, lte: dataFim }
        }
      }
    },
    select: {
      id: true,
      operador_id: true,
      operadores: { select: { id: true, nome: true } },
      leads:       { select: { id: true, nome: true, telefone: true } },
    }
  })

  // Agrupa por operador
  const porOperador: Record<number, { operador: { id: number; nome: string }; leads: { id: number; nome: string | null; telefone: string }[] }> = {}
  for (const c of conversasAtendidas) {
    if (!c.operadores) continue
    const opId = c.operadores.id
    if (!porOperador[opId]) {
      porOperador[opId] = { operador: c.operadores, leads: [] }
    }
    if (c.leads) {
      const jaExiste = porOperador[opId].leads.some(l => l.id === c.leads!.id)
      if (!jaExiste) porOperador[opId].leads.push(c.leads)
    }
  }

  const leadsAtendidos = Object.values(porOperador).map(({ operador, leads }) => ({
    operador,
    total: leads.length,
    leads,
  }))

  const totalAtendidos = leadsAtendidos.reduce((s, o) => s + o.total, 0)

  const eventosSelect = {
    id: true,
    nome_usuario:        true,
    email:               true,
    telefone:            true,
    data_evento:         true,
    operador_id:         true,
    valor:               true,
    is_primeiro_deposito: true,
    metodo_pagamento:    true,
    moeda:               true,
    operadores:          { select: { id: true, nome: true } },
    leads:               { select: { id: true, nome: true, telefone: true } },
  }

  // ── Registros e Depósitos no período ─────────────────────────────────────
  const [eventosRegistro, eventosDeposito] = await Promise.all([
    prisma.eventos_plataforma.findMany({
      where: { cliente_id: clienteId, tipo: 'registro', data_evento: { gte: dataInicio, lte: dataFim } },
      select: eventosSelect,
      orderBy: { data_evento: 'desc' }
    }),
    prisma.eventos_plataforma.findMany({
      where: { cliente_id: clienteId, tipo: 'deposito', data_evento: { gte: dataInicio, lte: dataFim } },
      select: eventosSelect,
      orderBy: { data_evento: 'desc' }
    }),
  ])

  // Separa FTD de redepósitos
  const ftd         = eventosDeposito.filter(e => e.is_primeiro_deposito === true)
  const redepositos = eventosDeposito.filter(e => e.is_primeiro_deposito !== true)

  const totalValorDepositos   = eventosDeposito.reduce((s, e) => s + Number(e.valor ?? 0), 0)
  const totalValorFTD         = ftd.reduce((s, e) => s + Number(e.valor ?? 0), 0)
  const totalValorRedepositos = redepositos.reduce((s, e) => s + Number(e.valor ?? 0), 0)

  return NextResponse.json({
    periodo: { inicio: dataInicio, fim: dataFim },
    leadsAtendidos: {
      total: totalAtendidos,
      porOperador: leadsAtendidos,
    },
    registros: {
      total: eventosRegistro.length,
      lista: eventosRegistro,
    },
    depositos: {
      total:      eventosDeposito.length,
      totalValor: totalValorDepositos,
      lista:      eventosDeposito,
      ftd: {
        total:      ftd.length,
        totalValor: totalValorFTD,
        lista:      ftd,
      },
      redepositos: {
        total:      redepositos.length,
        totalValor: totalValorRedepositos,
        lista:      redepositos,
      },
    },
  })
}
