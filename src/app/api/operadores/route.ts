import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

async function getPayload() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

// GET /api/operadores — lista operadores do cliente logado
export async function GET() {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

    const operadores = await prisma.operadores.findMany({
      where: { cliente_id: payload.cliente_id },
      include: {
        _count: {
          select: {
            conversas: {
              where: { status: { in: ['em_atendimento', 'aguardando_humano'] } }
            }
          }
        }
      },
      orderBy: { criado_em: 'desc' }
    })

    const resultado = operadores.map(op => ({
      id: op.id,
      nome: op.nome,
      email: op.email,
      nivel: op.nivel,
      ativo: op.ativo,
      na_fila: op.na_fila,
      criado_em: op.criado_em,
      conversasAtivas: op._count.conversas,
    }))

    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[GET /api/operadores]', err)
    return NextResponse.json({ erro: 'Erro ao listar operadores.' }, { status: 500 })
  }
}

// POST /api/operadores — cria operador no cliente do supervisor logado
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })
    if (payload.nivel !== 'supervisor') {
      return NextResponse.json({ erro: 'Apenas supervisores podem cadastrar operadores.' }, { status: 403 })
    }

    const { nome, email, senha, nivel } = await req.json()

    if (!nome || !email || !senha) {
      return NextResponse.json({ erro: 'Nome, email e senha são obrigatórios.' }, { status: 400 })
    }

    if (!['operador', 'supervisor'].includes(nivel)) {
      return NextResponse.json({ erro: 'Nível inválido. Use: operador ou supervisor.' }, { status: 400 })
    }

    const senha_hash = await bcrypt.hash(senha, 10)

    const operador = await prisma.operadores.create({
      data: { cliente_id: payload.cliente_id, nome, email, senha_hash, nivel: nivel ?? 'operador' },
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
