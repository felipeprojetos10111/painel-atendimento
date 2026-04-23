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

  const { id } = await params

  const resposta = await prisma.respostas_rapidas.findFirst({
    where: { id: Number(id), cliente_id: payload.cliente_id }
  })
  if (!resposta) return NextResponse.json({ erro: 'Resposta rápida não encontrada.' }, { status: 404 })

  if (resposta.url_midia) {
    try { await deletarArquivo(extrairChave(resposta.url_midia)) } catch { /* segue mesmo se falhar */ }
  }

  await prisma.respostas_rapidas.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}

// PATCH /api/respostas-rapidas/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  const existe = await prisma.respostas_rapidas.findFirst({
    where: { id: Number(id), cliente_id: payload.cliente_id }
  })
  if (!existe) return NextResponse.json({ erro: 'Resposta rápida não encontrada.' }, { status: 404 })

  const body = await req.json()

  const resposta = await prisma.respostas_rapidas.update({
    where: { id: Number(id) },
    data: {
      ...(body.titulo     !== undefined && { titulo:     body.titulo }),
      ...(body.tipo       !== undefined && { tipo:       body.tipo }),
      ...(body.conteudo   !== undefined && { conteudo:   body.conteudo }),
      ...(body.url_midia  !== undefined && { url_midia:  body.url_midia }),
      ...(body.categoria  !== undefined && { categoria:  body.categoria }),
      ...(body.atalho     !== undefined && { atalho:     body.atalho }),
      ...(body.ativo      !== undefined && { ativo:      body.ativo })
    }
  })

  return NextResponse.json(resposta)
}
