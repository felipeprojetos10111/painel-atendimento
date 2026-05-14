import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

async function getPayload() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

// GET /api/fila/disponibilidade — retorna na_fila do operador logado
export async function GET() {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const op = await prisma.operadores.findUnique({
    where: { id: payload.id },
    select: { na_fila: true }
  })

  return NextResponse.json({ na_fila: op?.na_fila ?? true })
}

// PATCH /api/fila/disponibilidade — operador alterna o próprio na_fila
export async function PATCH(req: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { na_fila } = await req.json()
  if (typeof na_fila !== 'boolean') {
    return NextResponse.json({ erro: 'na_fila deve ser boolean.' }, { status: 400 })
  }

  const op = await prisma.operadores.update({
    where: { id: payload.id },
    data: { na_fila },
    select: { id: true, na_fila: true }
  })

  return NextResponse.json({ na_fila: op.na_fila })
}
