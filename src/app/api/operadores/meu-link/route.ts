import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload || !payload.cliente_id) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })

  const [op, cliente] = await Promise.all([
    prisma.operadores.findUnique({
      where: { id: payload.id },
      select: { affiliate_link_id: true, mensagem_link: true }
    }),
    prisma.clientes.findUnique({
      where: { id: payload.cliente_id },
      select: { plataforma_base_url: true }
    })
  ])

  const affiliateId = op?.affiliate_link_id ?? ''
  const baseUrl     = cliente?.plataforma_base_url ?? ''

  // Constrói o link completo: URL_BASE + CÓDIGO
  let linkCompleto = ''
  if (baseUrl && affiliateId) {
    const sep = baseUrl.endsWith('/') || baseUrl.includes('=') || baseUrl.includes('?')
      ? ''
      : '/'
    linkCompleto = baseUrl + sep + affiliateId
  }

  return NextResponse.json({
    affiliate_link_id: affiliateId,
    link_completo:     linkCompleto,
    mensagem_link:     op?.mensagem_link ?? '',
  })
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })

  const { mensagem_link } = await req.json()

  await prisma.operadores.update({
    where: { id: payload.id },
    data: { mensagem_link: mensagem_link ?? null }
  })

  return NextResponse.json({ ok: true })
}
