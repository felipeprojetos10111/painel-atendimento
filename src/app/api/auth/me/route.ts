import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  // Busca lingua salva no banco (pode ter sido atualizada após o login)
  const operador = await prisma.operadores.findUnique({
    where: { id: payload.id },
    select: { lingua: true, idioma_traducao: true }
  })

  // Busca nome e logo do cliente (null para super_admin)
  let nomeCliente: string | null = null
  let logoCliente: string | null = null
  if (payload.cliente_id) {
    const cliente = await prisma.clientes.findUnique({
      where: { id: payload.cliente_id },
      select: { nome: true, logo_url: true }
    })
    nomeCliente = cliente?.nome ?? null
    logoCliente = cliente?.logo_url ?? null
  }

  // Detecta se está em modo impersonação (super_admin entrando como cliente)
  const cookieStore2 = await cookies()
  const impersonando = !!cookieStore2.get('token_super_admin')?.value

  const impersonandoOperador = !!cookieStore.get('token_supervisor')?.value

  return NextResponse.json({
    id:                payload.id,
    nome:              payload.nome,
    email:             payload.email,
    nivel:             payload.nivel,
    cliente_id:        payload.cliente_id,
    lingua:            operador?.lingua ?? 'en',
    idioma_traducao:   operador?.idioma_traducao ?? 'pt',
    nomeCliente,
    logoCliente,
    impersonando,
    impersonandoOperador,
  })
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const { lingua } = await req.json()
  if (!['pt', 'en', 'es'].includes(lingua)) {
    return NextResponse.json({ error: 'Idioma inválido' }, { status: 400 })
  }

  await prisma.operadores.update({
    where: { id: payload.id },
    data: { lingua }
  })

  return NextResponse.json({ ok: true })
}
