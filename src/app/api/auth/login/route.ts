import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json()

  if (!email || !senha) {
    return NextResponse.json({ erro: 'Email e senha são obrigatórios.' }, { status: 400 })
  }

  // ── Super Admin via variáveis de ambiente ─────────────────────────────────
  // Credenciais definidas em SUPER_ADMIN_EMAIL + SUPER_ADMIN_SENHA no .env.local
  if (
    process.env.SUPER_ADMIN_EMAIL &&
    process.env.SUPER_ADMIN_SENHA &&
    email === process.env.SUPER_ADMIN_EMAIL &&
    senha === process.env.SUPER_ADMIN_SENHA
  ) {
    const token = await signToken({
      id: 0,
      nome: 'Super Admin',
      email,
      nivel: 'super_admin',
      cliente_id: null
    })

    const res = NextResponse.json({ nome: 'Super Admin', email, nivel: 'super_admin' })
    res.cookies.set('token', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 8 })
    return res
  }

  // ── Operadores normais via banco ──────────────────────────────────────────
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
    nivel: operador.nivel ?? 'operador',
    cliente_id: operador.cliente_id
  })

  const res = NextResponse.json({ nome: operador.nome, email: operador.email, nivel: operador.nivel })
  res.cookies.set('token', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 8 })
  return res
}
