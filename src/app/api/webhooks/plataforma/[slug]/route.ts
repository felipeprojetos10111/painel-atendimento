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

  // Determina o tipo do evento — suporta campo no nível raiz ou dentro de body.data
  const tipoEvento: string = body.type ?? body.event ?? body.data?.type ?? body.data?.event ?? ''
  const tipo = tipoEvento === 'USER_CREATED' ? 'registro'
    : tipoEvento === 'DEPOSIT_CREATED' ? 'deposito'
    : null

  if (!tipo) {
    return NextResponse.json({ ok: true, ignorado: true })
  }

  // Dados podem vir no nível raiz ou aninhados em body.data
  const d = body.data ?? body

  // Extrai affiliateLinkId: tenta o campo direto primeiro,
  // se null/ausente extrai o último segmento do registerUrl
  let affiliateLinkId: string | null = d.affiliateLinkId ?? null
  if (!affiliateLinkId && d.registerUrl) {
    try {
      const url = new URL(d.registerUrl)
      const segmentos = url.pathname.split('/').filter(Boolean)
      const ultimo = segmentos[segmentos.length - 1] ?? ''
      if (ultimo && ultimo !== 'register') affiliateLinkId = ultimo
    } catch { /* URL inválida — ignora */ }
  }

  // Constrói o telefone completo: countryCode + phone
  const phoneRaw: string | null = d.phone ?? d.props?.user?.phone ?? null
  const countryCode: string | null = d.phoneCountryCode ?? d.props?.user?.phoneCountryCode ?? null
  const telefone: string | null = phoneRaw
    ? (countryCode ? countryCode.replace(/\D/g, '') + phoneRaw.replace(/\D/g, '') : phoneRaw)
    : null

  const email: string | null = d.email ?? null
  const nomeUsuario: string | null = d.name ?? null
  const plataformaUserId: string | null = d.userId ?? null
  const plataformaEventId: string | null = d.id ?? null
  const dataEvento: Date | null = d.date ? new Date(d.date) : null

  // ── Match primário: código único do link enviado ─────────────────────────
  // O código no registerUrl identifica exatamente qual envio gerou esse cadastro
  // → operador e lead vinculados sem precisar de telefone
  let operadorId: number | null = null
  let leadId: number | null = null
  let linkEnviadoId: number | null = null

  if (affiliateLinkId) {
    const linkEnviado = await prisma.links_enviados.findFirst({
      where: { cliente_id: cliente.id, codigo: affiliateLinkId },
      select: { id: true, operador_id: true, lead_id: true }
    })
    if (linkEnviado) {
      linkEnviadoId = linkEnviado.id
      operadorId    = linkEnviado.operador_id
      leadId        = linkEnviado.lead_id
    }
  }

  // ── Fallback: match por telefone (para cadastros sem link do operador) ────
  if (!leadId && telefone) {
    const digits = telefone.replace(/\D/g, '')
    const leads = await prisma.leads.findMany({
      where: { cliente_id: cliente.id },
      select: { id: true, telefone: true }
    })
    const leadMatch = leads.find(l =>
      l.telefone.replace(/\D/g, '').endsWith(digits) ||
      digits.endsWith(l.telefone.replace(/\D/g, ''))
    )
    if (leadMatch) leadId = leadMatch.id
  }

  // ── Fallback: match por email ─────────────────────────────────────────────
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
