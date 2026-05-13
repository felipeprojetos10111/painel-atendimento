import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { enviarMensagemWhatsApp, enviarMidiaWhatsApp } from '@/lib/whatsapp'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const mensagens = await prisma.mensagens.findMany({
    where: { conversa_id: Number(id) },
    orderBy: { enviado_em: 'asc' }
  })

  return NextResponse.json(mensagens)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.cookies.get('token')?.value
  const payload = token ? await verifyToken(token) : null

  const { conteudo, tipo, url_midia } = await req.json()

  const tipoFinal = tipo ?? 'texto'
  const isMidia = tipoFinal !== 'texto'

  if (!isMidia && !conteudo?.trim()) {
    return NextResponse.json({ erro: 'Conteúdo vazio.' }, { status: 400 })
  }
  if (isMidia && !url_midia) {
    return NextResponse.json({ erro: 'url_midia obrigatória para mídia.' }, { status: 400 })
  }

  const conversa = await prisma.conversas.findFirst({
    where: { id: Number(id), cliente_id: payload?.cliente_id ?? -1 },
    include: {
      leads:    { select: { telefone: true } },
      clientes: { select: { whatsapp_token: true, phone_number_id: true } }
    }
  })

  if (!conversa) {
    return NextResponse.json({ erro: 'Conversa não encontrada.' }, { status: 404 })
  }

  // Credenciais WhatsApp do cliente (fallback para env)
  const waCreds = {
    token:         conversa.clientes?.whatsapp_token,
    phoneNumberId: conversa.clientes?.phone_number_id,
  }

  // Salva mensagem com status inicial "enviando"
  const mensagem = await prisma.mensagens.create({
    data: {
      conversa_id: Number(id),
      origem:    'operador',
      conteudo:  isMidia ? (conteudo ?? '') : conteudo.trim(),
      tipo:      tipoFinal,
      url_midia: url_midia ?? null,
      status:    'enviando',
    }
  })

  // Auto-claim
  const atualizacaoConversa: Record<string, unknown> = { atualizado_em: new Date(), ultima_mensagem_em: new Date(), msgs_sem_resposta: 0 }
  if (payload?.nivel === 'operador' && !conversa.operador_id) {
    atualizacaoConversa.operador_id = payload.id
    if (['aguardando', 'aguardando_humano'].includes(conversa.status ?? '')) {
      atualizacaoConversa.status = 'em_atendimento'
    }
  }

  await prisma.conversas.update({
    where: { id: Number(id) },
    data: atualizacaoConversa
  })

  const io = (global as unknown as { io: import('socket.io').Server }).io

  // Emite mensagem em tempo real
  if (io) {
    io.to(`conversa-${id}`).emit('nova-mensagem', {
      ...mensagem,
      operador: payload?.nome ?? 'Operador'
    })
    io.to('operadores').emit('atualizar-lista', { conversaId: Number(id) })
  }

  // Envia via WhatsApp em background e atualiza status
  if (conversa.leads?.telefone) {
    const telefone = conversa.leads.telefone

    const atualizarStatus = async (novoStatus: string, waId?: string | null) => {
      const data: Record<string, unknown> = { status: novoStatus }
      if (waId) data.whatsapp_id = waId
      await prisma.mensagens.update({ where: { id: mensagem.id }, data })
      if (io) {
        io.to(`conversa-${id}`).emit('status-mensagem', { mensagemId: mensagem.id, status: novoStatus })
      }
    }

    const enviar = async () => {
      try {
        let waId: string | null = null
        if (isMidia && url_midia) {
          waId = await enviarMidiaWhatsApp(telefone, tipoFinal, url_midia, conteudo ?? undefined, waCreds)
        } else {
          waId = await enviarMensagemWhatsApp(telefone, conteudo.trim(), waCreds)
        }
        await atualizarStatus('enviado', waId)
      } catch (err) {
        console.error('[WhatsApp] Falha ao enviar para', telefone, '—', String(err))
        await atualizarStatus('erro')
      }
    }

    enviar()
  } else {
    console.warn('[WhatsApp] Conversa sem telefone de lead. conversa_id:', id)
  }

  return NextResponse.json(mensagem, { status: 201 })
}
