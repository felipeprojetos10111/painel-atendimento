import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enviarMensagemWhatsApp } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const { conversa_id } = await req.json()
  if (!conversa_id) return NextResponse.json({ erro: 'conversa_id obrigatório' }, { status: 400 })

  // Busca dados do operador (link + affiliate_id)
  const operador = await prisma.operadores.findUnique({
    where: { id: payload.id },
    select: { link_plataforma: true, affiliate_link_id: true, nome: true }
  })

  if (!operador?.link_plataforma) {
    return NextResponse.json({ erro: 'Você ainda não cadastrou seu link de registro. Acesse "Minhas Respostas" para configurar.' }, { status: 400 })
  }

  // Busca dados da conversa
  const conversa = await prisma.conversas.findFirst({
    where: { id: conversa_id, cliente_id: payload.cliente_id },
    include: {
      leads:    { select: { id: true, telefone: true, nome: true } },
      clientes: { select: { whatsapp_token: true, phone_number_id: true } }
    }
  })

  if (!conversa) return NextResponse.json({ erro: 'Conversa não encontrada' }, { status: 404 })
  if (!conversa.leads?.telefone) return NextResponse.json({ erro: 'Lead sem telefone' }, { status: 400 })

  // Registra o envio do link
  const linkEnviado = await prisma.links_enviados.create({
    data: {
      cliente_id:  payload.cliente_id,
      operador_id: payload.id,
      lead_id:     conversa.leads.id,
      conversa_id,
    }
  })

  // Envia a mensagem via WhatsApp
  const waCreds = {
    token:         conversa.clientes?.whatsapp_token,
    phoneNumberId: conversa.clientes?.phone_number_id,
  }

  const mensagemTexto = `Olá! Acesse o link abaixo para se registrar na plataforma:\n\n${operador.link_plataforma}`

  try {
    await enviarMensagemWhatsApp(conversa.leads.telefone, mensagemTexto, waCreds)
  } catch (err) {
    // Remove o registro se falhou o envio
    await prisma.links_enviados.delete({ where: { id: linkEnviado.id } })
    console.error('[enviar-link] Falha ao enviar WhatsApp:', err)
    return NextResponse.json({ erro: 'Falha ao enviar mensagem pelo WhatsApp.' }, { status: 500 })
  }

  // Salva como mensagem na conversa para aparecer no chat
  const mensagem = await prisma.mensagens.create({
    data: {
      conversa_id,
      origem:   'operador',
      conteudo: mensagemTexto,
      tipo:     'texto',
      status:   'enviado',
    }
  })

  // Atualiza ultima_mensagem_em
  await prisma.conversas.update({
    where: { id: conversa_id },
    data: { atualizado_em: new Date(), ultima_mensagem_em: new Date() }
  })

  // Emite via Socket.io
  const io = (global as unknown as { io: import('socket.io').Server }).io
  if (io) {
    io.to(`conversa-${conversa_id}`).emit('nova-mensagem', { ...mensagem, operador: payload.nome })
    io.to('operadores').emit('atualizar-lista', { conversaId: conversa_id })
  }

  return NextResponse.json({ ok: true, mensagem })
}
