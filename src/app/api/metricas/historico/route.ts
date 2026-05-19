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
  const periodo    = searchParams.get('periodo') ?? '7d'
  const opIdParam  = searchParams.get('operador_id')
  const clienteId  = payload.cliente_id

  // Operador comum só vê seus próprios dados — ignora qualquer param passado
  const operadorId = payload.nivel === 'operador'
    ? payload.id
    : (opIdParam ? parseInt(opIdParam) : null)

  const agora = new Date()
  let dataInicio: Date
  let granularidade: 'hora' | 'dia' | 'semana'

  switch (periodo) {
    case '1d':
      dataInicio = new Date(agora)
      dataInicio.setHours(0, 0, 0, 0)
      granularidade = 'hora'
      break
    case '7d':
      dataInicio = new Date(agora)
      dataInicio.setDate(dataInicio.getDate() - 7)
      granularidade = 'dia'
      break
    case '30d':
      dataInicio = new Date(agora)
      dataInicio.setDate(dataInicio.getDate() - 30)
      granularidade = 'dia'
      break
    default: // 'all'
      dataInicio = new Date('2020-01-01')
      granularidade = 'semana'
  }

  // Lead IDs do funil: apenas leads que passaram pelo fluxo WhatsApp (têm conversa)
  // Eventos sem lead_id (orgânicos do broker) são excluídos.
  const conversasFunil = await prisma.conversas.findMany({
    where: {
      cliente_id: clienteId,
      ...(operadorId ? { operador_id: operadorId } : {}),
    },
    select: { lead_id: true },
    distinct: ['lead_id'],
  })
  const leadIdsFunil = conversasFunil.map(c => c.lead_id).filter(Boolean) as number[]

  const [eventos, mensagensOp] = await Promise.all([
    leadIdsFunil.length > 0
      ? prisma.eventos_plataforma.findMany({
          where: {
            cliente_id:  clienteId,
            data_evento: { gte: dataInicio, lte: agora },
            lead_id:     { in: leadIdsFunil },
          },
          select: { tipo: true, is_primeiro_deposito: true, data_evento: true }
        })
      : Promise.resolve([]),
    prisma.mensagens.findMany({
      where: {
        enviado_em: { gte: dataInicio, lte: agora },
        origem:     { in: ['operador', 'ia'] },
        conversas: {
          cliente_id: clienteId,
          ...(operadorId ? { operador_id: operadorId } : {}),
        }
      },
      select: { enviado_em: true, conversas: { select: { lead_id: true } } }
    })
  ])

  function getBucket(date: Date): string {
    if (granularidade === 'hora') {
      return `${String(date.getHours()).padStart(2, '0')}:00`
    }
    if (granularidade === 'dia') {
      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
    }
    const d = new Date(date)
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1
    d.setDate(d.getDate() - day)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  type Bucket = { leadsAtendidos: Set<number>; ftd: number; redepositos: number; registros: number }
  const buckets: Record<string, Bucket> = {}

  function ensureBucket(key: string) {
    if (!buckets[key]) buckets[key] = { leadsAtendidos: new Set(), ftd: 0, redepositos: 0, registros: 0 }
  }

  if (granularidade === 'hora') {
    const d = new Date(dataInicio)
    while (d <= agora) { ensureBucket(getBucket(d)); d.setHours(d.getHours() + 1) }
  } else if (granularidade === 'dia') {
    const d = new Date(dataInicio)
    d.setHours(0, 0, 0, 0)
    while (d <= agora) { ensureBucket(getBucket(d)); d.setDate(d.getDate() + 1) }
  }

  for (const ev of eventos) {
    if (!ev.data_evento) continue
    const key = getBucket(ev.data_evento)
    ensureBucket(key)
    if (ev.tipo === 'registro') buckets[key].registros++
    if (ev.tipo === 'deposito') {
      if (ev.is_primeiro_deposito === true) buckets[key].ftd++
      else buckets[key].redepositos++
    }
  }

  for (const msg of mensagensOp) {
    if (!msg.enviado_em || !msg.conversas?.lead_id) continue
    const key = getBucket(msg.enviado_em)
    ensureBucket(key)
    buckets[key].leadsAtendidos.add(msg.conversas.lead_id)
  }

  const series = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, data]) => ({
      label,
      leadsAtendidos: data.leadsAtendidos.size,
      ftd:            data.ftd,
      redepositos:    data.redepositos,
      registros:      data.registros,
    }))

  return NextResponse.json({ periodo, granularidade, series })
}
