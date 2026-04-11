import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json()

  if (!email || !senha) {
    return NextResponse.json({ erro: 'Email e senha são obrigatórios.' }, { status: 400 })
  }

  const operador = await prisma.operadores.findUnique({ where: { email } })

  if (!operador || !operador.ativo) {
    return NextResponse.json({ erro: 'Credenciais inválidas.' }, { status: 401 })
  }

  const senhaValida = await bcrypt.compare(senha, operador.senha_hash)
  if (!senhaValida) {
    return NextResponse.json({ erro: 'Credenciais inválidas.' }, { status: 401 })
  }

  const token = await signToken({
    id: operador.id,
    nome: operador.nome,
    email: operador.email,
    nivel: operador.nivel ?? 'operador'
  })

  const res = NextResponse.json({
    nome: operador.nome,
    email: operador.email,
    nivel: operador.nivel
  })

  res.cookies.set('token', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 8
  })

  return res
}
