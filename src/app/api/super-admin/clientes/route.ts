import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

async function verificarSuperAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.nivel !== 'super_admin') return null
  return payload
}

// GET /api/super-admin/clientes — lista todos os clientes com métricas
export async function GET() {
  if (!await verificarSuperAdmin()) {
    return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })
  }

  const clientes = await prisma.clientes.findMany({
    orderBy: { criado_em: 'desc' },
    include: {
      _count: {
        select: { operadores: true, conversas: true, leads: true }
      }
    }
  })

  // Mascara tokens sensíveis antes de enviar ao frontend
  const resultado = clientes.map(c => ({
    id:             c.id,
    nome:           c.nome,
    slug:           c.slug,
    ativo:          c.ativo,
    criado_em:      c.criado_em,
    phone_number_id: c.phone_number_id,
    whatsapp_ok:    !!(c.whatsapp_token && c.phone_number_id),
    ia_ok:          !!c.ia_api_key,
    operadores:     c._count.operadores,
    conversas:      c._count.conversas,
    leads:          c._count.leads,
  }))

  return NextResponse.json(resultado)
}

// POST /api/super-admin/clientes — cria cliente + primeiro admin
export async function POST(req: NextRequest) {
  if (!await verificarSuperAdmin()) {
    return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json()
  const {
    nome, slug,
    whatsapp_token, phone_number_id, app_secret, verify_token, ia_api_key,
    admin_nome, admin_email, admin_senha
  } = body

  if (!nome?.trim() || !slug?.trim()) {
    return NextResponse.json({ erro: 'Nome e slug são obrigatórios.' }, { status: 400 })
  }
  if (!admin_nome?.trim() || !admin_email?.trim() || !admin_senha?.trim()) {
    return NextResponse.json({ erro: 'Dados do primeiro admin são obrigatórios.' }, { status: 400 })
  }

  try {
    // Cria cliente e primeiro admin em transação
    const resultado = await prisma.$transaction(async (tx) => {
      const cliente = await tx.clientes.create({
        data: {
          nome:            nome.trim(),
          slug:            slug.trim().toLowerCase(),
          whatsapp_token:  whatsapp_token  || null,
          phone_number_id: phone_number_id || null,
          app_secret:      app_secret      || null,
          verify_token:    verify_token    || null,
          ia_api_key:      ia_api_key      || null,
          ativo:           true,
        }
      })

      const senha_hash = await bcrypt.hash(admin_senha, 10)
      const admin = await tx.operadores.create({
        data: {
          cliente_id: cliente.id,
          nome:       admin_nome.trim(),
          email:      admin_email.trim().toLowerCase(),
          senha_hash,
          nivel:      'supervisor',
          ativo:      true,
        },
        select: { id: true, nome: true, email: true, nivel: true }
      })

      return { cliente, admin }
    })

    return NextResponse.json({
      cliente: {
        id:   resultado.cliente.id,
        nome: resultado.cliente.nome,
        slug: resultado.cliente.slug,
      },
      admin: resultado.admin,
    }, { status: 201 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('Unique constraint') || msg.includes('unique constraint')) {
      if (msg.includes('slug')) return NextResponse.json({ erro: 'Slug já em uso.' }, { status: 409 })
      if (msg.includes('email')) return NextResponse.json({ erro: 'Email já cadastrado.' }, { status: 409 })
    }
    console.error('[POST /api/super-admin/clientes]', err)
    return NextResponse.json({ erro: 'Erro ao criar cliente.' }, { status: 500 })
  }
}
