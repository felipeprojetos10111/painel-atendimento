import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { enviarMensagemWhatsApp } from '@/lib/whatsapp'

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

  const { conteudo } = await req.json()

  if (!conteudo?.trim()) {
    return NextResponse.json({ erro: 'Conteúdo vazio.' }, { status: 400 })
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
      origem: 'operador',
      conteudo: conteudo.trim(),
      tipo: 'texto'
    }
  })

  await prisma.conversas.update({
    where: { id: Number(id) },
    data: { atualizado_em: new Date() }
  })

  // Emite evento em tempo real via Socket.io
  const io = (global as unknown as { io: import('socket.io').Server }).io
  if (io) {
    io.to(`conversa-${id}`).emit('nova-mensagem', {
      ...mensagem,
      operador: payload?.nome ?? 'Operador'
    })
  }

  // Envia via WhatsApp (fire-and-forget: não bloqueia a resposta ao operador)
  if (conversa.leads?.telefone) {
    enviarMensagemWhatsApp(conversa.leads.telefone, conteudo.trim()).catch(err =>
      console.error('[WhatsApp] Falha ao enviar para', conversa.leads?.telefone, '—', String(err))
    )
  } else {
    console.warn('[WhatsApp] Conversa sem telefone de lead, mensagem não enviada. conversa_id:', id)
  }

  return NextResponse.json(mensagem, { status: 201 })
}
