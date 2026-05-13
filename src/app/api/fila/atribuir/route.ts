import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  // Rota interna chamada pelo whatsapp-gateway — valida INTERNAL_SECRET
  const secret = req.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { conversaId } = await req.json()
  if (!conversaId) {
    return NextResponse.json({ error: 'conversaId obrigatório' }, { status: 400 })
  }

  // Verifica se a conversa ainda está aguardando humano e sem operador
  const conversa = await prisma.conversas.findUnique({ where: { id: conversaId } })
  if (!conversa || conversa.status !== 'aguardando_humano' || conversa.operador_id) {
    return NextResponse.json({ ok: true, atribuido: false, motivo: 'conversa inelegível' })
  }

  // Pega operadores online (apenas operadores, não supervisores)
  const onlineOperators: Map<number, string> = (global as any).onlineOperators ?? new Map()
  const idsOnline = Array.from(onlineOperators.keys())

  if (idsOnline.length === 0) {
    // Nenhum operador online — conversa fica como aguardando_humano
    console.log(`[fila] Nenhum operador online. Conversa ${conversaId} aguardando.`)
    return NextResponse.json({ ok: true, atribuido: false, motivo: 'sem operadores online' })
  }

  // Busca operadores ativos do nível 'operador' (não supervisor) que estão online
  // e pertencem ao mesmo cliente da conversa (isolamento multi-tenant)
  const operadoresOnline = await prisma.operadores.findMany({
    where: { id: { in: idsOnline }, nivel: 'operador', ativo: true, cliente_id: conversa.cliente_id },
    select: { id: true }
  })

  if (operadoresOnline.length === 0) {
    console.log(`[fila] Operadores online são supervisores. Conversa ${conversaId} aguardando.`)
    return NextResponse.json({ ok: true, atribuido: false, motivo: 'apenas supervisores online' })
  }

  // Exclui operadores dedicados a fluxos (operador_escalacao_id / operador_link_id)
  const fluxosAtivos = await prisma.fluxos.findMany({
    where: { cliente_id: conversa.cliente_id, ativo: true },
    select: { definicao: true }
  })
  const idsFluxo = new Set<number>()
  for (const f of fluxosAtivos) {
    const def = f.definicao as any
    if (def?.agente?.operador_escalacao_id) idsFluxo.add(def.agente.operador_escalacao_id)
    if (def?.agente?.operador_link_id)      idsFluxo.add(def.agente.operador_link_id)
  }
  const operadoresFiltrados = operadoresOnline.filter(o => !idsFluxo.has(o.id))

  if (operadoresFiltrados.length === 0) {
    console.log(`[fila] Todos os operadores online são dedicados a fluxos. Conversa ${conversaId} aguardando.`)
    return NextResponse.json({ ok: true, atribuido: false, motivo: 'operadores dedicados a fluxos' })
  }

  // Conta conversas ativas por operador (em_atendimento ou aguardando_humano)
  const contagens = await prisma.conversas.groupBy({
    by: ['operador_id'],
    where: {
      operador_id: { in: operadoresFiltrados.map(o => o.id) },
      status: { in: ['em_atendimento', 'aguardando_humano'] }
    },
    _count: { id: true }
  })

  const mapaContagem = new Map<number, number>()
  for (const c of contagens) {
    if (c.operador_id) mapaContagem.set(c.operador_id, c._count.id)
  }

  // Encontra o operador com menor carga
  let operadorEscolhido = operadoresFiltrados[0].id
  let menorCarga = mapaContagem.get(operadorEscolhido) ?? 0

  for (const op of operadoresFiltrados) {
    const carga = mapaContagem.get(op.id) ?? 0
    if (carga < menorCarga) {
      menorCarga = carga
      operadorEscolhido = op.id
    }
  }

  // Atribui a conversa ao operador escolhido
  await prisma.conversas.update({
    where: { id: conversaId },
    data: { operador_id: operadorEscolhido, status: 'em_atendimento' }
  })

  console.log(`[fila] Conversa ${conversaId} atribuída ao operador ${operadorEscolhido} (carga: ${menorCarga})`)

  // Notifica o operador via Socket.io
  const io = (global as any).io
  if (io) {
    io.to('operadores').emit('conversa-atribuida', {
      conversaId,
      operadorId: operadorEscolhido
    })
  }

  return NextResponse.json({ ok: true, atribuido: true, operadorId: operadorEscolhido })
}
