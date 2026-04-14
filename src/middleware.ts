import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth'

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  const payload = token ? await verifyToken(token) : null

  // Sem sessão válida: redireciona para login
  if (!payload) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Rota /admin: exige nivel supervisor
  if (req.nextUrl.pathname.startsWith('/admin') && payload.nivel !== 'supervisor') {
    return NextResponse.redirect(new URL('/painel', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/painel', '/painel/:path*', '/admin', '/admin/:path*']
}
