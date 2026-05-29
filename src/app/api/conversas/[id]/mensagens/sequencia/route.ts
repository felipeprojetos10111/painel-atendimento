import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { enviarMensagemWhatsApp, enviarMidiaWhatsApp } from '@/lib/whatsapp'

/**
 * POST /api/conversas/[id]/mensagens/sequencia
 *
 * Envia uma sequência de itens (texto/mídia) de forma estritamente ordenada.
 * Ao contrário do endpoint padrão (fire-and-forget), este aguarda a confirmação
 * do WhatsApp para cada item antes de enviar o próximo, garantindo a ordem de
 * entrega — essencial para respostas rápidas com múltiplos áudios/mídias.
 *
 * Body: { itens: [{ conteudo, tipo, url_midia }] }
 * Response: mensagens[] (na ordem enviada, com status atualizado)
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

  // Auto-claim: atribui operador na primeira resposta (mesma lógica do endpoint padrão)
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

  const mensagensCriadas = []

  for (const item of itens) {
    const tipoFinal = item.tipo ?? 'texto'
    const isMidia = tipoFinal !== 'texto'

    // Pula itens de texto sem conteúdo (WhatsApp rejeita body vazio)
    if (!isMidia && !(item.conteudo ?? '').trim()) continue

    // Persiste a mensagem com status inicial "enviando"
    const mensagem = await prisma.mensagens.create({
      data: {
        conversa_id: Number(id),
        origem:    'operador',
        conteudo:  isMidia ? (item.conteudo ?? '') : (item.conteudo ?? '').trim(),
        tipo:      tipoFinal,
        url_midia: item.url_midia ?? null,
        status:    'enviando',
      }
    })

    // Notifica o painel em tempo real (aparece com status "enviando")
    if (io) {
      io.to(`conversa-${id}`).emit('nova-mensagem', {
        ...mensagem,
        operador: payload?.nome ?? 'Operador',
      })
    }

    // Envia ao WhatsApp e AGUARDA a resposta antes de prosseguir
    if (telefone) {
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

        mensagensCriadas.push({ ...mensagem, status: 'enviado', whatsapp_id: waId })
      } catch (err) {
        console.error('[WhatsApp sequencial] Falha ao enviar item —', String(err))

        await prisma.mensagens.update({
          where: { id: mensagem.id },
          data: { status: 'erro' },
        })

        if (io) {
          io.to(`conversa-${id}`).emit('status-mensagem', { mensagemId: mensagem.id, status: 'erro' })
        }

        mensagensCriadas.push({ ...mensagem, status: 'erro' })

        // Interrompe a sequência em caso de erro para não enviar itens fora de ordem
        break
      }
    } else {
      // Sem telefone: apenas salva no banco sem enviar ao WhatsApp
      mensagensCriadas.push(mensagem)
    }
  }

  // Notifica a lista de conversas para atualizar preview
  if (io) {
    io.to('operadores').emit('atualizar-lista', { conversaId: Number(id) })
  }

  return NextResponse.json(mensagensCriadas, { status: 201 })
}
