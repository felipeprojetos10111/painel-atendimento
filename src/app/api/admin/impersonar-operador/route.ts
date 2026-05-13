import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, signToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload || (payload.nivel !== 'supervisor' && payload.nivel !== 'super_admin')) {
    return NextResponse.json({ erro: 'Acesso restrito a supervisores' }, { status: 403 })
  }

  const { operadorId } = await req.json()
  if (!operadorId) return NextResponse.json({ erro: 'operadorId obrigatório' }, { status: 400 })

  const operadorIdNum = Number(operadorId)
  const clienteIdNum  = payload.cliente_id ? Number(payload.cliente_id) : null

  // Busca o operador — garante que pertence ao mesmo cliente
  const operador = await prisma.operadores.findFirst({
    where: {
      id: operadorIdNum,
      ...(clienteIdNum ? { cliente_id: clienteIdNum } : {}),
    },
    select: { id: true, nome: true, email: true, nivel: true, cliente_id: true, ativo: true },
  })

  if (!operador) {
    return NextResponse.json({ erro: 'Operador não encontrado' }, { status: 404 })
  }

  // Emite JWT como o operador selecionado
  const novoToken = await signToken({
    id:         operador.id,
    nome:       operador.nome,
    email:      operador.email,
    nivel:      operador.nivel ?? 'operador',
    cliente_id: operador.cliente_id,
  })

  const res = NextResponse.json({ ok: true })

  // Guarda o token atual (supervisor) para restaurar depois
  res.cookies.set('token_supervisor', token, {
    httpOnly: true,
    path:     '/',
    maxAge:   60 * 60 * 8,
    sameSite: 'lax',
  })

  // Substitui o token ativo pelo do operador
  res.cookies.set('token', novoToken, {
    httpOnly: true,
    path:     '/',
    maxAge:   60 * 60 * 8,
    sameSite: 'lax',
  })

  return res
}
