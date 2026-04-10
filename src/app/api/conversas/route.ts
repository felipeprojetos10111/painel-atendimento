import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const conversas = await prisma.conversas.findMany({
    orderBy: { atualizado_em: 'desc' },
    include: {
      leads: { select: { nome: true, telefone: true } },
      operadores: { select: { nome: true } },
      mensagens: {
        orderBy: { enviado_em: 'desc' },
        take: 1
      }
    }
  })

  return NextResponse.json(conversas)
}
