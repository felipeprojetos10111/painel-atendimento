import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { enviarMensagemWhatsApp, enviarMidiaWhatsApp } from '@/lib/whatsapp'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.cookies.get('token')?.value
  const payload = token ? await verifyToken(token) : null
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const mensagem = await prisma.mensagens.findUnique({
    where: { id: Number(id) },
    include: {
      conversas: {
        include: {
          leads:    { select: { telefone: true } },
          clientes: { select: { whatsapp_token: true, phone_number_id: true } }
        }
      }
    }
  })

  if (!mensagem) return NextResponse.json({ erro: 'Mensagem não encontrada.' }, { status: 404 })
  if (mensagem.origem !== 'operador') return NextResponse.json({ erro: 'Só mensagens de operador podem ser reenviadas.' }, { status: 400 })

  const telefone = mensagem.conversas?.leads?.telefone
  if (!telefone) return NextResponse.json({ erro: 'Lead sem telefone.' }, { status: 400 })

  // Credenciais WhatsApp do cliente (igual à rota de envio normal)
  const waCreds = {
    token:         mensagem.conversas?.clientes?.whatsapp_token,
    phoneNumberId: mensagem.conversas?.clientes?.phone_number_id,
  }

  // Marca como "enviando" novamente
  await prisma.mensagens.update({ where: { id: mensagem.id }, data: { status: 'enviando' } })

  const io = (global as unknown as { io: import('socket.io').Server }).io
  const conversaId = mensagem.conversa_id

  if (io && conversaId) {
    io.to(`conversa-${conversaId}`).emit('status-mensagem', { mensagemId: mensagem.id, status: 'enviando' })
  }

  const isMidia = mensagem.tipo !== 'texto'

  const enviar = async () => {
    try {
      let waId: string | null = null
      if (isMidia && mensagem.url_midia) {
        waId = await enviarMidiaWhatsApp(telefone, mensagem.tipo!, mensagem.url_midia, mensagem.conteudo || undefined, waCreds)
      } else if ((mensagem.conteudo ?? '').trim()) {
        waId = await enviarMensagemWhatsApp(telefone, mensagem.conteudo, waCreds)
      } else {
        throw new Error('Mensagem de texto sem conteúdo — não é possível reenviar.')
      }
      const data: Record<string, unknown> = { status: 'enviado' }
      if (waId) data.whatsapp_id = waId
      await prisma.mensagens.update({ where: { id: mensagem.id }, data })
      if (io && conversaId) {
        io.to(`conversa-${conversaId}`).emit('status-mensagem', { mensagemId: mensagem.id, status: 'enviado' })
      }
    } catch (err) {
      console.error('[reenviar] Falha:', String(err))
      await prisma.mensagens.update({ where: { id: mensagem.id }, data: { status: 'erro' } })
      if (io && conversaId) {
        io.to(`conversa-${conversaId}`).emit('status-mensagem', { mensagemId: mensagem.id, status: 'erro' })
      }
    }
  }

  enviar()

  return NextResponse.json({ ok: true })
}
