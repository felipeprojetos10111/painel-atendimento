import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const conversa = await prisma.conversas.update({
    where: { id: Number(id) },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.operador_id && { operador_id: body.operador_id }),
      atualizado_em: new Date()
    }
  })

  return NextResponse.json(conversa)
}
