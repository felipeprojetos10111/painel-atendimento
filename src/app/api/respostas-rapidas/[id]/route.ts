import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { deletarArquivo, extrairChave } from '@/lib/r2'

async function getPayload() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

// DELETE /api/respostas-rapidas/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const { id } = await params

  const resposta = await prisma.respostas_rapidas.findFirst({
    where: { id: Number(id), operador_id: payload.id },
    include: { itens: true }
  })
  if (!resposta) return NextResponse.json({ erro: 'Resposta rápida não encontrada.' }, { status: 404 })

  // Apaga todos os arquivos R2 (itens + campo legado)
  const urlsParaDeletar = [
    ...resposta.itens.map(i => i.url_midia).filter(Boolean),
    resposta.url_midia
  ].filter(Boolean) as string[]

  for (const url of urlsParaDeletar) {
    try { await deletarArquivo(extrairChave(url)) } catch { /* segue mesmo se falhar */ }
  }

  await prisma.respostas_rapidas.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}

// PATCH /api/respostas-rapidas/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  if (!payload.cliente_id) return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const { id } = await params

  const existe = await prisma.respostas_rapidas.findFirst({
    where: { id: Number(id), operador_id: payload.id }
  })
  if (!existe) return NextResponse.json({ erro: 'Resposta rápida não encontrada.' }, { status: 404 })

  const body = await req.json()

  try {
    await prisma.respostas_rapidas.update({
      where: { id: Number(id) },
      data: {
        ...(body.titulo    !== undefined && { titulo:    body.titulo }),
        ...(body.categoria !== undefined && { categoria: body.categoria }),
        ...(body.atalho    !== undefined && { atalho:    body.atalho }),
        ...(body.ativo     !== undefined && { ativo:     body.ativo }),
        ...(body.favorita  !== undefined && { favorita:  body.favorita }),
        // Atualiza campos legados com o primeiro item para manter compatibilidade
        ...(body.itens?.length && {
          tipo:      body.itens[0].tipo,
          conteudo:  body.itens[0].conteudo  || null,
          url_midia: body.itens[0].url_midia || null,
        }),
      }
    })

    // Substitui itens se fornecidos
    if (body.itens !== undefined) {
      await prisma.respostas_rapidas_itens.deleteMany({ where: { resposta_id: Number(id) } })
      if (body.itens.length > 0) {
        await prisma.respostas_rapidas_itens.createMany({
          data: body.itens.map((item: { tipo: string; conteudo?: string; url_midia?: string; delay_depois?: number }, i: number) => ({
            resposta_id:  Number(id),
            ordem:        i,
            tipo:         item.tipo,
            conteudo:     item.conteudo    || null,
            url_midia:    item.url_midia   || null,
            delay_depois: Number(item.delay_depois) || 0,
          }))
        })
      }
    }

    const atualizada = await prisma.respostas_rapidas.findUnique({
      where: { id: Number(id) },
      include: { itens: { orderBy: { ordem: 'asc' } } }
    })

    return NextResponse.json(atualizada)
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro interno.'
    if (mensagem.includes('Unique constraint') || mensagem.includes('unique constraint')) {
      return NextResponse.json({ erro: 'Já existe uma resposta com esse atalho.' }, { status: 409 })
    }
    return NextResponse.json({ erro: 'Erro ao atualizar resposta.' }, { status: 500 })
  }
}
