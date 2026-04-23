import { NextRequest, NextResponse } from 'next/server'
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

// PATCH /api/super-admin/clientes/[id] — atualiza dados e credenciais
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarSuperAdmin()) {
    return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  const data: Record<string, unknown> = {}
  if (body.nome            !== undefined) data.nome            = body.nome
  if (body.slug            !== undefined) data.slug            = String(body.slug).toLowerCase()
  if (body.ativo           !== undefined) data.ativo           = Boolean(body.ativo)
  if (body.whatsapp_token  !== undefined) data.whatsapp_token  = body.whatsapp_token  || null
  if (body.phone_number_id !== undefined) data.phone_number_id = body.phone_number_id || null
  if (body.app_secret      !== undefined) data.app_secret      = body.app_secret      || null
  if (body.verify_token    !== undefined) data.verify_token    = body.verify_token    || null
  // Só atualiza ia_api_key se enviada e não mascarada
  if (body.ia_api_key && body.ia_api_key !== '••••••••') data.ia_api_key = body.ia_api_key

  try {
    const cliente = await prisma.clientes.update({
      where: { id: Number(id) },
      data,
    })

    return NextResponse.json({
      id:             cliente.id,
      nome:           cliente.nome,
      slug:           cliente.slug,
      ativo:          cliente.ativo,
      phone_number_id: cliente.phone_number_id,
      whatsapp_ok:    !!(cliente.whatsapp_token && cliente.phone_number_id),
      ia_ok:          !!cliente.ia_api_key,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('Unique constraint') || msg.includes('unique constraint')) {
      return NextResponse.json({ erro: 'Slug já em uso.' }, { status: 409 })
    }
    console.error('[PATCH /api/super-admin/clientes]', err)
    return NextResponse.json({ erro: 'Erro ao atualizar cliente.' }, { status: 500 })
  }
}

// DELETE /api/super-admin/clientes/[id] — remove cliente e todos os dados (cascade)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verificarSuperAdmin()) {
    return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })
  }

  const { id } = await params

  try {
    await prisma.clientes.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/super-admin/clientes]', err)
    return NextResponse.json({ erro: 'Erro ao deletar cliente.' }, { status: 500 })
  }
}
