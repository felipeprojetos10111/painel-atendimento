import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth'

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  const payload = token ? await verifyToken(token) : null
  const path = req.nextUrl.pathname

  // Sem sessão válida: redireciona para login
  if (!payload) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // super_admin em /painel → redireciona para /super-admin
  if (path.startsWith('/painel') && payload.nivel === 'super_admin') {
    return NextResponse.redirect(new URL('/super-admin', req.url))
  }

  // /super-admin: exclusivo para super_admin
  if (path.startsWith('/super-admin') && payload.nivel !== 'super_admin') {
    return NextResponse.redirect(new URL('/painel', req.url))
  }

  // /admin: supervisor do cliente ou super_admin
  if (path.startsWith('/admin') && payload.nivel !== 'supervisor' && payload.nivel !== 'super_admin') {
    return NextResponse.redirect(new URL('/painel', req.url))
  }

  // /minhas-respostas: qualquer operador autenticado com cliente_id (não super_admin)
  if (path.startsWith('/minhas-respostas') && payload.nivel === 'super_admin') {
    return NextResponse.redirect(new URL('/super-admin', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/painel', '/painel/:path*',
    '/admin', '/admin/:path*',
    '/super-admin', '/super-admin/:path*',
    '/minhas-respostas', '/minhas-respostas/:path*'
  ]
}
