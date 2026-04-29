import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  const tokenOriginal = cookieStore.get('token_super_admin')?.value

  if (!tokenOriginal) {
    return NextResponse.json({ erro: 'Nenhuma sessão de impersonação ativa.' }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })

  // Restaura o token original do super admin
  res.cookies.set('token', tokenOriginal, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 8,
    sameSite: 'lax',
  })

  // Remove o cookie de impersonação
  res.cookies.delete('token_super_admin')

  return res
}
