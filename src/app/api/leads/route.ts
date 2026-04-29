import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const leads = await prisma.leads.findMany({
    where: { cliente_id: payload.cliente_id },
    orderBy: { criado_em: 'desc' },
    select: {
      id: true,
      telefone: true,
      nome: true,
      email: true,
      criado_em: true,
      _count: { select: { conversas: true } }
    }
  })

  return NextResponse.json(leads)
}
