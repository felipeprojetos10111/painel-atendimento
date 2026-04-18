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

  // Busca a conversa com o telefone do lead para enviar via WhatsApp
  const conversa = await prisma.conversas.findUnique({
    where: { id: Number(id) },
    include: { leads: { select: { telefone: true } } }
  })

  if (!conversa) {
    return NextResponse.json({ erro: 'Conversa não encontrada.' }, { status: 404 })
  }

  const mensagem = await prisma.mensagens.create({
    data: {
      conversa_id: Number(id),
      origem:    'operador',
      conteudo:  isMidia ? (conteudo ?? '') : conteudo.trim(),
      tipo:      tipoFinal,
      url_midia: url_midia ?? null,
    }
  })

  // Auto-claim: operador reivindica a conversa ao responder (só se ainda sem dono)
  const atualizacaoConversa: Record<string, unknown> = { atualizado_em: new Date() }
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

  // Emite evento em tempo real via Socket.io
  const io = (global as unknown as { io: import('socket.io').Server }).io
  if (io) {
    io.to(`conversa-${id}`).emit('nova-mensagem', {
      ...mensagem,
      operador: payload?.nome ?? 'Operador'
    })
    io.to('operadores').emit('atualizar-lista', { conversaId: Number(id) })
  }

  // Envia via WhatsApp
  if (conversa.leads?.telefone) {
    if (isMidia && url_midia) {
      enviarMidiaWhatsApp(conversa.leads.telefone, tipoFinal, url_midia, conteudo ?? undefined).catch(err =>
        console.error('[WhatsApp] Falha ao enviar mídia para', conversa.leads?.telefone, '—', String(err))
      )
    } else {
      enviarMensagemWhatsApp(conversa.leads.telefone, conteudo.trim()).catch(err =>
        console.error('[WhatsApp] Falha ao enviar para', conversa.leads?.telefone, '—', String(err))
      )
    }
  } else {
    console.warn('[WhatsApp] Conversa sem telefone de lead. conversa_id:', id)
  }

  return NextResponse.json(mensagem, { status: 201 })
}
