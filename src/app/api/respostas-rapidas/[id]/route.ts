import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deletarArquivo, extrairChave } from '@/lib/r2'

// DELETE /api/respostas-rapidas/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const resposta = await prisma.respostas_rapidas.findUnique({
    where: { id: Number(id) }
  })

  if (!resposta) {
    return NextResponse.json({ erro: 'Resposta rápida não encontrada.' }, { status: 404 })
  }

  // Remove o arquivo do R2 se houver mídia
  if (resposta.url_midia) {
    try {
      await deletarArquivo(extrairChave(resposta.url_midia))
    } catch {
      // Segue mesmo se falhar a remoção no R2
    }
  }

  await prisma.respostas_rapidas.delete({ where: { id: Number(id) } })

  return NextResponse.json({ ok: true })
}

// PATCH /api/respostas-rapidas/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const resposta = await prisma.respostas_rapidas.update({
    where: { id: Number(id) },
    data: {
      ...(body.titulo !== undefined && { titulo: body.titulo }),
      ...(body.tipo !== undefined && { tipo: body.tipo }),
      ...(body.conteudo !== undefined && { conteudo: body.conteudo }),
      ...(body.url_midia !== undefined && { url_midia: body.url_midia }),
      ...(body.categoria !== undefined && { categoria: body.categoria }),
      ...(body.atalho !== undefined && { atalho: body.atalho }),
      ...(body.ativo !== undefined && { ativo: body.ativo })
    }
  })

  return NextResponse.json(resposta)
}
