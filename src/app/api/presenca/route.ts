import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function fecharSessaoAberta(operadorId: number) {
  const agora = new Date()
  const sessao = await prisma.sessoes_presenca.findFirst({
    where: { operador_id: operadorId, fim: null },
    orderBy: { inicio: 'desc' },
  })
  if (!sessao) return
  const duracao = Math.max(1, Math.round((agora.getTime() - sessao.inicio.getTime()) / 60000))
  await prisma.sessoes_presenca.update({
    where: { id: sessao.id },
    data:  { fim: agora, duracao_min: duracao },
  })
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ ok: true }) // silencioso — pode ser beacon

  const payload = await verifyToken(token)

  // Ignora super_admin (id=0) e tokens inválidos
  if (!payload || payload.id === 0 || !payload.cliente_id) {
    return NextResponse.json({ ok: true })
  }

  const body = await req.json().catch(() => ({}))
  const status: string = body.status ?? 'ativo'

  if (!['ativo', 'standby', 'offline'].includes(status)) {
    return NextResponse.json({ erro: 'Status inválido' }, { status: 400 })
  }

  const operadorId = payload.id
  const clienteId  = payload.cliente_id

  // Fecha sessão anterior (se houver)
  await fecharSessaoAberta(operadorId)

  // 'offline' = apenas fecha, não abre nova
  if (status === 'offline') {
    return NextResponse.json({ ok: true })
  }

  // Abre nova sessão
  await prisma.sessoes_presenca.create({
    data: {
      operador_id: operadorId,
      cliente_id:  clienteId,
      status,
      inicio:      new Date(),
    },
  })

  return NextResponse.json({ ok: true })
}
