import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, signToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload || payload.nivel !== 'super_admin') {
    return NextResponse.json({ erro: 'Acesso restrito ao super admin' }, { status: 403 })
  }

  const { clienteId } = await req.json()
  if (!clienteId) return NextResponse.json({ erro: 'clienteId obrigatório' }, { status: 400 })

  // Busca supervisor ativo; se não tiver, usa qualquer operador ativo
  const operador = await prisma.operadores.findFirst({
    where: { cliente_id: clienteId, nivel: 'supervisor', ativo: true },
    orderBy: { id: 'asc' },
  }) ?? await prisma.operadores.findFirst({
    where: { cliente_id: clienteId, ativo: true },
    orderBy: { id: 'asc' },
  })

  if (!operador) {
    return NextResponse.json({ erro: 'Nenhum operador ativo encontrado para este cliente.' }, { status: 404 })
  }

  // Emite JWT como supervisor (promove temporariamente para ter acesso ao /admin)
  const novoToken = await signToken({
    id:         operador.id,
    nome:       operador.nome,
    email:      operador.email,
    nivel:      'supervisor',
    cliente_id: clienteId,
  })

  const res = NextResponse.json({ ok: true })

  // Guarda o token original do super admin para restaurar depois
  res.cookies.set('token_super_admin', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 8, // 8h
    sameSite: 'lax',
  })

  // Substitui o token ativo pelo do supervisor impersonado
  res.cookies.set('token', novoToken, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 8,
    sameSite: 'lax',
  })

  return res
}
