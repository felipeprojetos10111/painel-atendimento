import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  // Supervisores veem todas as conversas
  // Operadores veem apenas as suas próprias + aguardando_humano sem operador atribuído
  const where = payload.nivel === 'supervisor'
    ? {}
    : {
        OR: [
          { operador_id: payload.id },
          { operador_id: null, status: 'aguardando_humano' },
          { operador_id: null, status: 'aguardando' },
        ]
      }

  const conversas = await prisma.conversas.findMany({
    where,
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
