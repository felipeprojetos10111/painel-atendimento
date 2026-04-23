import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const body = await req.json()

  // Apenas supervisores podem transferir (mudar operador_id)
  if (body.operador_id !== undefined && payload.nivel !== 'supervisor') {
    return NextResponse.json({ erro: 'Apenas supervisores podem transferir conversas.' }, { status: 403 })
  }

  // Verifica que a conversa pertence ao cliente do operador logado
  const conversaExiste = await prisma.conversas.findFirst({
    where: { id: Number(id), cliente_id: payload.cliente_id }
  })
  if (!conversaExiste) return NextResponse.json({ erro: 'Conversa não encontrada.' }, { status: 404 })

  const conversa = await prisma.conversas.update({
    where: { id: Number(id) },
    data: {
      ...(body.status      !== undefined && { status: body.status }),
      ...(body.operador_id !== undefined && { operador_id: body.operador_id }),
      ...(body.nao_lidas   !== undefined && { nao_lidas: body.nao_lidas }),
      atualizado_em: new Date()
    }
  })

  // Notifica todos via Socket.io para atualizar listas em tempo real
  const io = (global as unknown as { io: import('socket.io').Server }).io
  if (io && (body.status !== undefined || body.operador_id !== undefined)) {
    io.to('operadores').emit('atualizar-lista', { conversaId: Number(id) })
    // Notifica também quem está dentro da conversa (ex: status mudou para resolvida)
    io.to(`conversa-${id}`).emit('status-alterado', {
      conversaId: Number(id),
      status: conversa.status,
      operadorId: conversa.operador_id
    })
  }

  return NextResponse.json(conversa)
}
