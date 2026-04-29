import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })

  const op = await prisma.operadores.findUnique({
    where: { id: payload.id },
    select: { link_plataforma: true, affiliate_link_id: true }
  })

  return NextResponse.json({
    link_plataforma:   op?.link_plataforma   ?? '',
    affiliate_link_id: op?.affiliate_link_id ?? '',
  })
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })

  const { link_plataforma, affiliate_link_id } = await req.json()

  await prisma.operadores.update({
    where: { id: payload.id },
    data: {
      link_plataforma:   link_plataforma   ?? null,
      affiliate_link_id: affiliate_link_id ?? null,
    }
  })

  return NextResponse.json({ ok: true })
}
