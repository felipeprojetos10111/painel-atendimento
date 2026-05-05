import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  const tokenSupervisor = cookieStore.get('token_supervisor')?.value

  if (!tokenSupervisor) {
    return NextResponse.json({ erro: 'Nenhuma sessão de impersonação ativa.' }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })

  // Restaura o token do supervisor
  res.cookies.set('token', tokenSupervisor, {
    httpOnly: true,
    path:     '/',
    maxAge:   60 * 60 * 8,
    sameSite: 'lax',
  })

  res.cookies.delete('token_supervisor')

  return res
}
