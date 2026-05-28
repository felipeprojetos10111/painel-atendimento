import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Dado um pool de operadores, retorna o id do que tem menos conversas ativas */
async function escolherMenorCarga(ids: number[]): Promise<{ id: number; carga: number }> {
  const contagens = await prisma.conversas.groupBy({
    by: ['operador_id'],
    where: {
      operador_id: { in: ids },
      status: { in: ['em_atendimento', 'aguardando_humano'] },
    },
    _count: { id: true },
  })

  const mapa = new Map<number, number>()
  for (const c of contagens) {
    if (c.operador_id) mapa.set(c.operador_id, c._count.id)
  }

  let escolhido = ids[0]
  let menorCarga = mapa.get(escolhido) ?? 0

  for (const id of ids) {
    const carga = mapa.get(id) ?? 0
    if (carga < menorCarga) {
      menorCarga = carga
      escolhido = id
    }
  }

  return { id: escolhido, carga: menorCarga }
}

// ── POST /api/fila/atribuir ────────────────────────────────────────────────────
//
// Rota interna chamada pelo whatsapp-gateway ao receber mensagem de lead novo.
//
// Estratégia de atribuição em 3 tiers (balanceamento por menor carga):
//   Tier 1 — Online + na_fila=true    → preferencial (operador está disponível agora)
//   Tier 2 — Ativo  + na_fila=true    → verá o lead ao entrar (se marcou disponível)
//   Tier 3 — Ativo  (qualquer)        → último recurso, garante que nenhum lead fique órfão
//
// A cada tier o operador com MENOS conversas ativas é escolhido.
// Se nenhum operador existir no cliente, retorna erro e loga alerta.

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { conversaId } = await req.json()
  if (!conversaId) {
    return NextResponse.json({ error: 'conversaId obrigatório' }, { status: 400 })
  }

  // Verifica elegibilidade da conversa
  const conversa = await prisma.conversas.findUnique({ where: { id: conversaId } })
  if (!conversa || conversa.status !== 'aguardando_humano' || conversa.operador_id) {
    return NextResponse.json({ ok: true, atribuido: false, motivo: 'conversa inelegível' })
  }

  const clienteId = conversa.cliente_id

  // ── Tier 1: online + na_fila=true ─────────────────────────────────────────
  const onlineOperators: Map<number, string> = (global as any).onlineOperators ?? new Map()
  const idsOnline = Array.from(onlineOperators.keys())

  if (idsOnline.length > 0) {
    const tier1 = await prisma.operadores.findMany({
      where: {
        id: { in: idsOnline },
        cliente_id: clienteId,
        nivel: 'operador',
        ativo: true,
        na_fila: true,
      },
      select: { id: true },
    })

    if (tier1.length > 0) {
      const { id, carga } = await escolherMenorCarga(tier1.map(o => o.id))
      await atribuir(conversaId, id, carga, 'tier1-online')
      return NextResponse.json({ ok: true, atribuido: true, operadorId: id, tier: 1 })
    }
  }

  // ── Tier 2: ativo + na_fila=true (mesmo que offline) ──────────────────────
  const tier2 = await prisma.operadores.findMany({
    where: { cliente_id: clienteId, nivel: 'operador', ativo: true, na_fila: true },
    select: { id: true },
  })

  if (tier2.length > 0) {
    const { id, carga } = await escolherMenorCarga(tier2.map(o => o.id))
    await atribuir(conversaId, id, carga, 'tier2-na-fila')
    return NextResponse.json({ ok: true, atribuido: true, operadorId: id, tier: 2 })
  }

  // ── Tier 3: qualquer operador ativo (último recurso) ──────────────────────
  const tier3 = await prisma.operadores.findMany({
    where: { cliente_id: clienteId, nivel: 'operador', ativo: true },
    select: { id: true },
  })

  if (tier3.length > 0) {
    const { id, carga } = await escolherMenorCarga(tier3.map(o => o.id))
    await atribuir(conversaId, id, carga, 'tier3-fallback')
    return NextResponse.json({ ok: true, atribuido: true, operadorId: id, tier: 3 })
  }

  // ── Sem operadores no cliente ──────────────────────────────────────────────
  console.warn(`[fila] ⚠️  Cliente ${clienteId} não tem operadores ativos. Conversa ${conversaId} aguardando.`)
  return NextResponse.json({ ok: true, atribuido: false, motivo: 'sem operadores no cliente' })
}

// ── Atribui e notifica ─────────────────────────────────────────────────────────
async function atribuir(conversaId: number, operadorId: number, carga: number, tier: string) {
  await prisma.conversas.update({
    where: { id: conversaId },
    data: { operador_id: operadorId, status: 'em_atendimento' },
  })

  console.log(`[fila] Conversa ${conversaId} → operador ${operadorId} (carga: ${carga}, ${tier})`)

  const io = (global as any).io
  if (io) {
    io.to('operadores').emit('conversa-atribuida', { conversaId, operadorId })
  }
}
