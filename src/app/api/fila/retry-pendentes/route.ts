import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/fila/retry-pendentes
//
// Rota interna chamada periodicamente pelo server.js (a cada 5 min).
// Encontra TODAS as conversas aguardando_humano sem operador, em qualquer cliente,
// e tenta atribuir cada uma via /api/fila/atribuir (reusa os 3 tiers de fallback).
//
// Garante que nenhum lead fique órfão mesmo que nenhum operador entre online.

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Busca todas as conversas pendentes sem operador, mais antigas primeiro
  const pendentes = await prisma.conversas.findMany({
    where: {
      status: 'aguardando_humano',
      operador_id: null,
    },
    select: { id: true, cliente_id: true },
    orderBy: { atualizado_em: 'asc' },
  })

  if (pendentes.length === 0) {
    return NextResponse.json({ ok: true, processadas: 0, atribuidas: 0 })
  }

  console.log(`[fila/retry] ${pendentes.length} conversa(s) sem operador — tentando atribuir...`)

  const base = `http://localhost:${process.env.PORT ?? 3001}`
  let atribuidas = 0
  let falhas = 0

  for (const conversa of pendentes) {
    try {
      const res = await fetch(`${base}/api/fila/atribuir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': secret,
        },
        body: JSON.stringify({ conversaId: conversa.id }),
      })

      const data = await res.json()

      if (data.atribuido) {
        atribuidas++
      } else if (data.motivo === 'sem operadores no cliente') {
        // Não há operadores neste cliente — inutiliza tentativas futuras para o mesmo cliente
        falhas++
        console.warn(`[fila/retry] Cliente ${conversa.cliente_id} sem operadores. Conversa ${conversa.id} permanece na fila.`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[fila/retry] Erro ao atribuir conversa ${conversa.id}:`, msg)
      falhas++
    }
  }

  console.log(`[fila/retry] Resultado: ${atribuidas} atribuída(s), ${falhas} sem operador, ${pendentes.length - atribuidas - falhas} já tratadas`)

  return NextResponse.json({
    ok: true,
    processadas: pendentes.length,
    atribuidas,
    falhas,
  })
}
