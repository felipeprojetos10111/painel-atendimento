import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

/**
 * GET /api/admin/historico-conversas
 * Retorna TODAS as conversas do cliente (incluindo resolvidas) para supervisores.
 * Suporta filtros: status, operador_id, busca por lead (nome/telefone), paginação.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })
  if (payload.nivel !== 'supervisor' && payload.nivel !== 'super_admin') {
    return NextResponse.json({ erro: 'Acesso restrito a supervisores' }, { status: 403 })
  }

  const url = req.nextUrl
  const status    = url.searchParams.get('status') ?? ''
  const operadorId = url.searchParams.get('operador_id') ?? ''
  const busca     = url.searchParams.get('busca') ?? ''
  const pagina    = Math.max(0, Number(url.searchParams.get('pagina') ?? 0))
  const limite    = 30

  const where: Record<string, unknown> = { cliente_id: payload.cliente_id }

  if (status) where.status = status

  if (operadorId === 'sem') {
    where.operador_id = null
  } else if (operadorId) {
    where.operador_id = Number(operadorId)
  }

  if (busca) {
    where.leads = {
      OR: [
        { nome: { contains: busca, mode: 'insensitive' } },
        { telefone: { contains: busca } },
      ]
    }
  }

  const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [total, conversas] = await Promise.all([
    prisma.conversas.count({ where }),
    prisma.conversas.findMany({
      where,
      orderBy: { atualizado_em: 'desc' },
      skip: pagina * limite,
      take: limite,
      include: {
        leads:      { select: { id: true, nome: true, telefone: true } },
        operadores: { select: { id: true, nome: true } },
        mensagens: {
          orderBy: { enviado_em: 'desc' },
          take: 1,
          select: { conteudo: true, origem: true, enviado_em: true, tipo: true }
        }
      }
    })
  ])

  const resultado = conversas.map(c => ({
    ...c,
    janela_expirada: c.ultima_mensagem_em
      ? c.ultima_mensagem_em < limite24h
      : true,
  }))

  return NextResponse.json({ conversas: resultado, total, pagina, limite })
}
