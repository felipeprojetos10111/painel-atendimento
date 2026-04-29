import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Rota pública — sem autenticação por cookie
// Validada pelo header Authorization: Bearer {webhook_secret}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Identifica o cliente pelo slug
  const cliente = await prisma.clientes.findFirst({
    where: { slug, ativo: true },
    select: { id: true, webhook_secret: true }
  })

  if (!cliente) {
    return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 })
  }

  // Valida o token de autorização
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!cliente.webhook_secret || token !== cliente.webhook_secret) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()

  // Determina o tipo do evento pelo campo que a plataforma envia
  // USER_CREATED → registro | DEPOSIT_CREATED → deposito
  const tipoEvento = body.type ?? body.event ?? ''
  const tipo = tipoEvento === 'USER_CREATED' ? 'registro'
    : tipoEvento === 'DEPOSIT_CREATED' ? 'deposito'
    : null

  if (!tipo) {
    // Evento desconhecido — aceita mas ignora
    return NextResponse.json({ ok: true, ignorado: true })
  }

  const affiliateLinkId: string | null = body.affiliateLinkId ?? null
  const telefone: string | null = body.phone ?? body.props?.user?.phone ?? null
  const email: string | null = body.email ?? null
  const nomeUsuario: string | null = body.name ?? null
  const plataformaUserId: string | null = body.userId ?? null
  const plataformaEventId: string | null = body.id ?? null
  const dataEvento: Date | null = body.date ? new Date(body.date) : null

  // ── Tenta vincular ao operador pelo affiliateLinkId ───────────────────────
  // Busca o operador cujo link_plataforma contém o affiliateLinkId enviado pela plataforma
  let operadorId: number | null = null
  if (affiliateLinkId) {
    const op = await prisma.operadores.findFirst({
      where: {
        cliente_id: cliente.id,
        link_plataforma: { contains: affiliateLinkId }
      },
      select: { id: true }
    })
    operadorId = op?.id ?? null
  }

  // ── Tenta vincular ao lead pelo telefone (sufixo) ou email ────────────────
  let leadId: number | null = null
  let linkEnviadoId: number | null = null

  if (telefone) {
    const digits = telefone.replace(/\D/g, '')
    const leads = await prisma.leads.findMany({
      where: { cliente_id: cliente.id },
      select: { id: true, telefone: true }
    })
    const leadMatch = leads.find(l =>
      l.telefone.replace(/\D/g, '').endsWith(digits) ||
      digits.endsWith(l.telefone.replace(/\D/g, ''))
    )
    if (leadMatch) {
      leadId = leadMatch.id

      // Busca se houve um link enviado para esse lead por esse operador
      if (operadorId && leadId) {
        const linkEnviado = await prisma.links_enviados.findFirst({
          where: { cliente_id: cliente.id, operador_id: operadorId, lead_id: leadId },
          orderBy: { enviado_em: 'desc' },
          select: { id: true }
        })
        linkEnviadoId = linkEnviado?.id ?? null
      }
    }
  }

  // Fallback: tenta por email se não achou por telefone
  if (!leadId && email) {
    const leadByEmail = await prisma.leads.findFirst({
      where: { cliente_id: cliente.id, email },
      select: { id: true }
    })
    leadId = leadByEmail?.id ?? null
  }

  // Evita duplicatas pelo ID do evento da plataforma
  if (plataformaEventId) {
    const existente = await prisma.eventos_plataforma.findFirst({
      where: { cliente_id: cliente.id, plataforma_event_id: plataformaEventId }
    })
    if (existente) {
      return NextResponse.json({ ok: true, duplicado: true })
    }
  }

  // Salva o evento
  await prisma.eventos_plataforma.create({
    data: {
      cliente_id:          cliente.id,
      lead_id:             leadId,
      operador_id:         operadorId,
      link_enviado_id:     linkEnviadoId,
      tipo,
      plataforma_event_id: plataformaEventId,
      plataforma_user_id:  plataformaUserId,
      email,
      nome_usuario:        nomeUsuario,
      telefone,
      affiliate_link_id:   affiliateLinkId,
      payload:             body,
      data_evento:         dataEvento,
    }
  })

  console.log(`[webhook] ${tipo} — cliente:${cliente.id} lead:${leadId ?? 'não vinculado'} operador:${operadorId ?? 'não vinculado'}`)

  return NextResponse.json({ ok: true })
}
