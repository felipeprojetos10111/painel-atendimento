import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const leads = await prisma.leads.findMany({
    where: { cliente_id: payload.cliente_id },
    orderBy: { criado_em: 'desc' },
    select: {
      id: true,
      telefone: true,
      nome: true,
      email: true,
      criado_em: true,
      conversas: {
        select: {
          id: true,
          status: true,
          criado_em: true,
          mensagens: {
            orderBy: { enviado_em: 'desc' },
            take: 1,
            select: { enviado_em: true }
          }
        }
      }
    }
  })

  // Monta CSV com BOM para compatibilidade com Excel
  const linhas: string[] = [
    'Telefone,Nome,Email,Total de Conversas,Última Conversa,Primeiro Contato'
  ]

  for (const lead of leads) {
    const totalConversas = lead.conversas.length
    const ultimaConversa = lead.conversas
      .map(c => c.mensagens[0]?.enviado_em ?? c.criado_em)
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0]

    const fmt = (d: Date | string | null | undefined) =>
      d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''

    const escapar = (v: string | null | undefined) => {
      if (!v) return ''
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`
      }
      return v
    }

    linhas.push([
      escapar(lead.telefone),
      escapar(lead.nome),
      escapar(lead.email),
      String(totalConversas),
      escapar(fmt(ultimaConversa)),
      escapar(fmt(lead.criado_em)),
    ].join(','))
  }

  const csv = '\uFEFF' + linhas.join('\r\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads_${payload.cliente_id}_${new Date().toISOString().slice(0, 10)}.csv"`,
    }
  })
}
