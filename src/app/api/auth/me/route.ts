import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  // Busca lingua salva no banco (pode ter sido atualizada após o login)
  const operador = await prisma.operadores.findUnique({
    where: { id: payload.id },
    select: { lingua: true }
  })

  return NextResponse.json({
    id: payload.id,
    nome: payload.nome,
    email: payload.email,
    nivel: payload.nivel,
    lingua: operador?.lingua ?? 'en',
  })
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const { lingua } = await req.json()
  if (!['pt', 'en', 'es'].includes(lingua)) {
    return NextResponse.json({ error: 'Idioma inválido' }, { status: 400 })
  }

  await prisma.operadores.update({
    where: { id: payload.id },
    data: { lingua }
  })

  return NextResponse.json({ ok: true })
}
