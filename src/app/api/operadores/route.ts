import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// GET /api/operadores
export async function GET() {
  try {
    const operadores = await prisma.operadores.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        nivel: true,
        ativo: true,
        criado_em: true
      },
      orderBy: { criado_em: 'desc' }
    })

    return NextResponse.json(operadores)
  } catch (err) {
    console.error('[GET /api/operadores]', err)
    return NextResponse.json({ erro: 'Erro ao listar operadores.' }, { status: 500 })
  }
}

// POST /api/operadores
export async function POST(req: NextRequest) {
  try {
    const { nome, email, senha, nivel } = await req.json()

    if (!nome || !email || !senha) {
      return NextResponse.json({ erro: 'Nome, email e senha são obrigatórios.' }, { status: 400 })
    }

    if (!['operador', 'supervisor'].includes(nivel)) {
      return NextResponse.json({ erro: 'Nível inválido. Use: operador ou supervisor.' }, { status: 400 })
    }

    const senha_hash = await bcrypt.hash(senha, 10)

    const operador = await prisma.operadores.create({
      data: { nome, email, senha_hash, nivel: nivel ?? 'operador' },
      select: { id: true, nome: true, email: true, nivel: true, ativo: true, criado_em: true }
    })

    return NextResponse.json(operador, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('Unique constraint') || msg.includes('unique constraint')) {
      return NextResponse.json({ erro: 'Já existe um operador com este email.' }, { status: 409 })
    }
    console.error('[POST /api/operadores]', err)
    return NextResponse.json({ erro: 'Erro interno ao cadastrar operador.' }, { status: 500 })
  }
}
