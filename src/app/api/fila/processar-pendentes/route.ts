import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/fila/processar-pendentes
// Rota interna — chamada pelo server.js quando um operador entra online.
// Encontra todas as conversas aguardando_humano sem operador do cliente desse operador
// e tenta atribuir cada uma usando /api/fila/atribuir (reusa lógica de menor carga).

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { operadorId } = await req.json()
  if (!operadorId) {
    return NextResponse.json({ error: 'operadorId obrigatório' }, { status: 400 })
  }

  // Busca o operador para pegar o cliente_id e validar que é um operador ativo
  const operador = await prisma.operadores.findUnique({
    where: { id: operadorId },
    select: { cliente_id: true, nivel: true, ativo: true }
  })

  if (!operador?.ativo || operador.nivel !== 'operador') {
    // Supervisores não recebem conversas automáticas — não processa
    return NextResponse.json({ ok: true, processadas: 0, motivo: 'operador inelegível' })
  }

  // Busca todas as conversas sem operador, ordenadas da mais antiga para a mais nova
  const pendentes = await prisma.conversas.findMany({
    where: {
      cliente_id: operador.cliente_id,
      status:     'aguardando_humano',
      operador_id: null
    },
    select:   { id: true },
    orderBy:  { atualizado_em: 'asc' }
  })

  if (pendentes.length === 0) {
    return NextResponse.json({ ok: true, processadas: 0 })
  }

  console.log(`[fila] Operador ${operadorId} online — ${pendentes.length} conversa(s) pendente(s) para processar`)

  const base   = `http://localhost:${process.env.PORT ?? 3001}`
  let atribuidas = 0

  for (const conversa of pendentes) {
    try {
      const res = await fetch(`${base}/api/fila/atribuir`, {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-internal-secret': secret
        },
        body: JSON.stringify({ conversaId: conversa.id })
      })

      const data = await res.json()

      if (data.atribuido) {
        atribuidas++
        console.log(`[fila] Conversa ${conversa.id} atribuída (pendente → operador ${data.operadorId})`)
      } else {
        // Se um atribuir falhou por 'sem operadores online', os demais também falharão
        // Interrompe o loop para não fazer chamadas desnecessárias
        if (data.motivo === 'sem operadores online' || data.motivo === 'apenas supervisores online') {
          console.log(`[fila] Loop interrompido: ${data.motivo}`)
          break
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[fila] Erro ao atribuir conversa ${conversa.id}:`, msg)
    }
  }

  return NextResponse.json({ ok: true, processadas: pendentes.length, atribuidas })
}
