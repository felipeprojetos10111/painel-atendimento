import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload || payload.nivel !== 'supervisor') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const onlineOperators: Map<number, string> = (global as any).onlineOperators ?? new Map()
  const ids = Array.from(onlineOperators.keys())

  return NextResponse.json({ online: ids })
}
