import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { enviarMensagemWhatsApp, enviarMidiaWhatsApp } from '@/lib/whatsapp'

/**
 * POST /api/conversas/[id]/mensagens/sequencia
 *
 * Estratégia otimizada:
 * 1. Cria TODOS os registros no banco imediatamente (rápido)
 * 2. Retorna a resposta ao cliente sem esperar o WhatsApp
 * 3. Envia ao WhatsApp em background mantendo a ordem via async serial
 * 4. Atualiza status via Socket.io conforme cada envio é confirmado
 *
 * Body: { itens: [{ conteudo, tipo, url_midia, delay_depois }] }
 * Response: mensagens[] com status "enviando" (atualiza via socket)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.cookies.get('token')?.value
  const payload = token ? await verifyToken(token) : null

  const { itens } = await req.json()

  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ erro: 'Campo "itens" obrigatório.' }, { status: 400 })
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

  const waCreds = {
    token:         conversa.clientes?.whatsapp_token,
    phoneNumberId: conversa.clientes?.phone_number_id,
  }

  const telefone = conversa.leads?.telefone
  const io = (global as unknown as { io: import('socket.io').Server }).io

  // Auto-claim + atualiza conversa
  const atualizacaoConversa: Record<string, unknown> = {
    atualizado_em:      new Date(),
    ultima_mensagem_em: new Date(),
    msgs_sem_resposta:  0,
  }
  if (payload?.nivel === 'operador' && !conversa.operador_id) {
    atualizacaoConversa.operador_id = payload.id
    if (['aguardando', 'aguardando_humano'].includes(conversa.status ?? '')) {
      atualizacaoConversa.status = 'em_atendimento'
    }
  }
  await prisma.conversas.update({ where: { id: Number(id) }, data: atualizacaoConversa })

  // ── FASE 1: cria todos os registros no banco imediatamente ──────────────
  const itensFiltrados = itens.filter(item => {
    const isMidia = (item.tipo ?? 'texto') !== 'texto'
    return isMidia ? !!item.url_midia : !!(item.conteudo ?? '').trim()
  })

  const mensagensCriadas = await Promise.all(
    itensFiltrados.map((item) =>
      prisma.mensagens.create({
        data: {
          conversa_id: Number(id),
          origem:    'operador',
          conteudo:  (item.tipo ?? 'texto') !== 'texto' ? (item.conteudo ?? '') : (item.conteudo ?? '').trim(),
          tipo:      item.tipo ?? 'texto',
          url_midia: item.url_midia ?? null,
          status:    'enviando',
        }
      })
    )
  )

  // Notifica o painel imediatamente — todas as mensagens aparecem com "enviando"
  if (io) {
    for (const mensagem of mensagensCriadas) {
      io.to(`conversa-${id}`).emit('nova-mensagem', {
        ...mensagem,
        operador: payload?.nome ?? 'Operador',
      })
    }
    io.to('operadores').emit('atualizar-lista', { conversaId: Number(id) })
  }

  // ── FASE 2: envia ao WhatsApp em background, mantendo a ordem ──────────
  if (telefone) {
    const enviarBackground = async () => {
      for (let i = 0; i < mensagensCriadas.length; i++) {
        const mensagem = mensagensCriadas[i]
        const item     = itensFiltrados[i]
        const tipoFinal = item.tipo ?? 'texto'
        const isMidia   = tipoFinal !== 'texto'

        try {
          let waId: string | null = null
          if (isMidia && item.url_midia) {
            waId = await enviarMidiaWhatsApp(telefone, tipoFinal, item.url_midia, item.conteudo ?? undefined, waCreds)
          } else {
            waId = await enviarMensagemWhatsApp(telefone, (item.conteudo ?? '').trim(), waCreds)
          }

          await prisma.mensagens.update({
            where: { id: mensagem.id },
            data: { status: 'enviado', whatsapp_id: waId },
          })

          if (io) {
            io.to(`conversa-${id}`).emit('status-mensagem', { mensagemId: mensagem.id, status: 'enviado' })
          }
        } catch (err) {
          console.error('[WhatsApp sequencial] Falha ao enviar item —', String(err))
          await prisma.mensagens.update({
            where: { id: mensagem.id },
            data: { status: 'erro' },
          })
          if (io) {
            io.to(`conversa-${id}`).emit('status-mensagem', { mensagemId: mensagem.id, status: 'erro' })
          }
          break // Interrompe para não enviar fora de ordem
        }

        // Delay entre itens (exceto no último)
        const isUltimo = i === mensagensCriadas.length - 1
        const delayMs  = Math.min(Math.max(Number(item.delay_depois) || 0, 0), 120) * 1000
        if (delayMs > 0 && !isUltimo) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }

    // Fire-and-forget — não bloqueia a resposta HTTP
    enviarBackground()
  }

  // Retorna imediatamente com as mensagens criadas (status "enviando")
  return NextResponse.json(mensagensCriadas, { status: 201 })
}
