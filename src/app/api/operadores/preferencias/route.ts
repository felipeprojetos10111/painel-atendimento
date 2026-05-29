import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })

    const { idioma_traducao } = await req.json()

    if (!['pt', 'en', 'es'].includes(idioma_traducao)) {
      return NextResponse.json({ erro: 'Idioma inválido. Use: pt, en ou es.' }, { status: 400 })
    }

    await prisma.operadores.update({
      where: { id: payload.id },
      data: { idioma_traducao },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/operadores/preferencias]', err)
    return NextResponse.json({ erro: 'Erro interno ao atualizar preferências.' }, { status: 500 })
  }
}
