import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/fluxos/[id]/ativar — ativa fluxo (e desativa outros padrão se is_padrao)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })
  const payload = await verifyToken(token)
  if (!payload || (payload.nivel !== 'supervisor' && payload.nivel !== 'super_admin'))
    return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const fluxo = await prisma.fluxos.findFirst({
    where: { id: Number(id), cliente_id: payload.cliente_id ?? undefined }
  })
  if (!fluxo) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const ativar = body.ativo !== false // padrão: ativar

  await prisma.$transaction(async (tx) => {
    // Se ativando como padrão, desativa outros padrões deste cliente
    if (ativar && fluxo.is_padrao) {
      await tx.fluxos.updateMany({
        where: {
          cliente_id: payload.cliente_id ?? undefined,
          is_padrao: true,
          ativo: true,
          id: { not: Number(id) }
        },
        data: { ativo: false }
      })
    }
    await tx.fluxos.update({
      where: { id: Number(id) },
      data: {
        ativo: ativar,
        is_padrao: ativar ? (body.is_padrao ?? fluxo.is_padrao) : fluxo.is_padrao,
        atualizado_em: new Date()
      }
    })
  })

  return NextResponse.json({ ok: true, ativo: ativar })
}
