/**
 * Script de correção única: preenche operador_id nos eventos que têm lead_id
 * mas operador_id = null, buscando o operador nas conversas desse lead.
 *
 * Rodar: npx tsx scripts/corrigir-atribuicao.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Todos os eventos sem operador mas com lead
  const eventos = await prisma.eventos_plataforma.findMany({
    where: {
      operador_id: null,
      lead_id:     { not: null },
    },
    select: { id: true, lead_id: true, cliente_id: true, tipo: true },
  })

  console.log(`Eventos sem operador com lead vinculado: ${eventos.length}`)

  let corrigidos = 0

  for (const ev of eventos) {
    // Busca o primeiro operador que atendeu esse lead
    const conversa = await prisma.conversas.findFirst({
      where: {
        cliente_id:  ev.cliente_id,
        lead_id:     ev.lead_id!,
        operador_id: { not: null },
      },
      orderBy: { criado_em: 'asc' },
      select: { operador_id: true },
    })

    if (!conversa?.operador_id) continue

    await prisma.eventos_plataforma.update({
      where: { id: ev.id },
      data:  { operador_id: conversa.operador_id },
    })

    corrigidos++
    console.log(`  ✓ evento ${ev.id} (${ev.tipo}) → operador ${conversa.operador_id}`)
  }

  console.log(`\nConcluído: ${corrigidos} de ${eventos.length} eventos corrigidos.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
