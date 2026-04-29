import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ error: 'Sem contexto de cliente' }, { status: 403 })

  const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const clienteFilter = { cliente_id: payload.cliente_id }
  const isSupervisor = payload.nivel === 'supervisor'

  // Supervisores veem todas (ativas + expiradas, exceto resolvidas)
  // Operadores veem apenas conversas dentro da janela de 24h
  const baseWhere = isSupervisor
    ? { ...clienteFilter, status: { not: 'resolvida' } }
    : {
        ...clienteFilter,
        status: { not: 'resolvida' },
        OR: [
          { ultima_mensagem_em: { gt: limite24h } },
          { ultima_mensagem_em: null },
        ],
      }

  const where = isSupervisor
    ? baseWhere
    : {
        AND: [
          baseWhere,
          {
            OR: [
              { operador_id: payload.id },
              { operador_id: null, status: 'aguardando_humano' },
              { operador_id: null, status: 'aguardando' },
            ]
          }
        ]
      }

  const conversas = await prisma.conversas.findMany({
    where,
    orderBy: { atualizado_em: 'desc' },
    include: {
      leads: { select: { nome: true, telefone: true } },
      operadores: { select: { nome: true } },
      mensagens: {
        orderBy: { enviado_em: 'desc' },
        take: 1
      }
    }
  })

  // Adiciona flag janela_expirada para o frontend diferenciar visualmente
  const resultado = conversas.map(c => ({
    ...c,
    janela_expirada: c.ultima_mensagem_em
      ? c.ultima_mensagem_em < limite24h
      : false,
  }))

  return NextResponse.json(resultado)
}
