import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enviarMensagemWhatsApp } from '@/lib/whatsapp'
import { randomBytes } from 'crypto'

function gerarCodigo(): string {
  // 12 chars hex — único por envio, vincula lead+operador sem precisar de telefone
  return randomBytes(6).toString('hex')
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const body = await req.json()
  const { conversa_id, mensagem_prefixo } = body
  if (!conversa_id) return NextResponse.json({ erro: 'conversa_id obrigatório' }, { status: 400 })

  // Busca dados da conversa + URL base da plataforma
  const conversa = await prisma.conversas.findFirst({
    where: { id: conversa_id, cliente_id: payload.cliente_id },
    include: {
      leads:    { select: { id: true, telefone: true, nome: true } },
      clientes: { select: { whatsapp_token: true, phone_number_id: true, plataforma_base_url: true, redirect_domain: true, link_curto_ativo: true } }
    }
  })

  if (!conversa) return NextResponse.json({ erro: 'Conversa não encontrada' }, { status: 404 })
  if (!conversa.leads?.telefone) return NextResponse.json({ erro: 'Lead sem telefone' }, { status: 400 })

  const baseUrl = conversa.clientes?.plataforma_base_url
  if (!baseUrl) {
    return NextResponse.json({ erro: 'URL da plataforma não configurada. Acesse Admin > Configurações para definir a URL base.' }, { status: 400 })
  }

  // Reutiliza o código se já enviamos link para esse lead+operador antes
  // Isso garante que o mesmo lead sempre recebe o mesmo link, independente de quantas vezes for enviado
  const envioExistente = await prisma.links_enviados.findFirst({
    where: {
      cliente_id:  payload.cliente_id,
      operador_id: payload.id,
      lead_id:     conversa.leads.id,
      codigo:      { not: null },
    },
    orderBy: { enviado_em: 'asc' },
    select: { id: true, codigo: true }
  })

  const codigo = envioExistente?.codigo ?? gerarCodigo()

  // Usa link curto se o cliente tiver o domínio configurado E o toggle ativo
  const redirectDomain = conversa.clientes?.redirect_domain
  const linkCurtoAtivo = conversa.clientes?.link_curto_ativo
  const usarLinkCurto = linkCurtoAtivo && redirectDomain
  const sep = baseUrl.endsWith('=') || baseUrl.endsWith('/') ? '' : '/'
  const linkExclusivo = usarLinkCurto
    ? `https://${redirectDomain!.replace(/^https?:\/\//, '')}/r/${codigo}`
    : baseUrl + sep + codigo

  // Registra novo envio (mesmo código, nova entrada para rastrear quando foi enviado)
  const linkEnviado = await prisma.links_enviados.create({
    data: {
      cliente_id:  payload.cliente_id,
      operador_id: payload.id,
      lead_id:     conversa.leads.id,
      conversa_id,
      codigo,
    }
  })

  // Envia a mensagem via WhatsApp
  const waCreds = {
    token:         conversa.clientes?.whatsapp_token,
    phoneNumberId: conversa.clientes?.phone_number_id,
  }

  const prefixo = typeof mensagem_prefixo === 'string' ? mensagem_prefixo.trim() : ''
  const mensagemTexto = prefixo ? `${prefixo}\n\n${linkExclusivo}` : linkExclusivo

  try {
    await enviarMensagemWhatsApp(conversa.leads.telefone, mensagemTexto, waCreds)
  } catch (err) {
    await prisma.links_enviados.delete({ where: { id: linkEnviado.id } })
    console.error('[enviar-link] Falha ao enviar WhatsApp:', err)
    return NextResponse.json({ erro: 'Falha ao enviar mensagem pelo WhatsApp.' }, { status: 500 })
  }

  // Salva como mensagem na conversa
  const mensagem = await prisma.mensagens.create({
    data: {
      conversa_id,
      origem:   'operador',
      conteudo: mensagemTexto,
      tipo:     'texto',
      status:   'enviado',
    }
  })

  await prisma.conversas.update({
    where: { id: conversa_id },
    data: { atualizado_em: new Date(), ultima_mensagem_em: new Date() }
  })

  const io = (global as unknown as { io: import('socket.io').Server }).io
  if (io) {
    io.to(`conversa-${conversa_id}`).emit('nova-mensagem', { ...mensagem, operador: payload.nome })
    io.to('operadores').emit('atualizar-lista', { conversaId: conversa_id })
  }

  return NextResponse.json({ ok: true, mensagem })
}
