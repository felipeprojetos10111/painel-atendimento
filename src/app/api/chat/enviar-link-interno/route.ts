/**
 * Rota interna: chamada pelo gateway (fluxo automatizado) para enviar link rastreado.
 * Autenticada por x-internal-secret, não por cookie JWT.
 * Reutiliza a lógica de enviar-link mas sem necessidade de sessão de operador.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarMensagemWhatsApp } from '@/lib/whatsapp'
import { randomBytes } from 'crypto'

function gerarCodigo(): string {
  return randomBytes(6).toString('hex')
}

export async function POST(req: NextRequest) {
  // Valida secret interno
  const secret = req.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { conversa_id, mensagem_prefixo } = body
  if (!conversa_id) return NextResponse.json({ erro: 'conversa_id obrigatório' }, { status: 400 })

  const conversa = await prisma.conversas.findFirst({
    where: { id: conversa_id },
    include: {
      leads:    { select: { id: true, telefone: true, nome: true } },
      clientes: { select: {
        id: true, whatsapp_token: true, phone_number_id: true,
        plataforma_base_url: true, redirect_domain: true, link_curto_ativo: true
      }}
    }
  })

  if (!conversa) return NextResponse.json({ erro: 'Conversa não encontrada' }, { status: 404 })
  if (!conversa.leads?.telefone) return NextResponse.json({ erro: 'Lead sem telefone' }, { status: 400 })

  const baseUrl = conversa.clientes?.plataforma_base_url
  if (!baseUrl) return NextResponse.json({ erro: 'URL da plataforma não configurada' }, { status: 400 })

  // Link sem operador_id — enviado pelo fluxo automatizado
  const codigo = gerarCodigo()
  const redirectDomain = conversa.clientes?.redirect_domain
  const linkCurtoAtivo = conversa.clientes?.link_curto_ativo
  const usarLinkCurto = linkCurtoAtivo && redirectDomain
  const sep = baseUrl.endsWith('=') || baseUrl.endsWith('/') ? '' : '/'
  const linkExclusivo = usarLinkCurto
    ? `https://${redirectDomain!.replace(/^https?:\/\//, '')}/r/${codigo}`
    : baseUrl + sep + codigo

  // Registra em links_enviados sem operador (enviado pelo fluxo)
  const linkEnviado = await prisma.links_enviados.create({
    data: {
      cliente_id:  conversa.clientes!.id,
      operador_id: null,
      lead_id:     conversa.leads.id,
      conversa_id,
      codigo,
    }
  })

  const prefixo = typeof mensagem_prefixo === 'string' ? mensagem_prefixo.trim() : ''
  const mensagemTexto = prefixo ? `${prefixo}\n\n${linkExclusivo}` : linkExclusivo

  const waCreds = {
    token:         conversa.clientes?.whatsapp_token,
    phoneNumberId: conversa.clientes?.phone_number_id,
  }

  try {
    await enviarMensagemWhatsApp(conversa.leads.telefone, mensagemTexto, waCreds)
  } catch (err) {
    await prisma.links_enviados.delete({ where: { id: linkEnviado.id } })
    return NextResponse.json({ erro: 'Falha ao enviar WhatsApp' }, { status: 500 })
  }

  // Persiste mensagem na conversa
  await prisma.mensagens.create({
    data: {
      conversa_id,
      origem:      'ia',
      conteudo:    mensagemTexto,
      tipo:        'texto',
      status:      'enviado',
      origem_fluxo: 'estagio_mensagem',
    }
  })

  await prisma.conversas.update({
    where: { id: conversa_id },
    data: { atualizado_em: new Date(), ultima_mensagem_em: new Date() }
  })

  return NextResponse.json({ ok: true, link: linkExclusivo })
}
