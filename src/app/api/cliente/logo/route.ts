import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadBuffer, deletarArquivo } from '@/lib/r2'
import { randomUUID } from 'crypto'

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']

async function verificarSupervisor() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.nivel !== 'supervisor' || !payload.cliente_id) return null
  return payload as typeof payload & { cliente_id: number }
}

// POST /api/cliente/logo — faz upload da logo do cliente para o R2
export async function POST(req: NextRequest) {
  const payload = await verificarSupervisor()
  if (!payload) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const formData = await req.formData()
  const arquivo = formData.get('arquivo') as File | null

  if (!arquivo) return NextResponse.json({ erro: 'Arquivo obrigatório.' }, { status: 400 })
  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    return NextResponse.json({ erro: 'Apenas JPG, PNG ou WebP são permitidos.' }, { status: 400 })
  }
  if (arquivo.size > 2 * 1024 * 1024) {
    return NextResponse.json({ erro: 'Imagem deve ter no máximo 2MB.' }, { status: 400 })
  }

  // Remove logo anterior do R2 se existir
  const clienteAtual = await prisma.clientes.findUnique({
    where: { id: payload.cliente_id },
    select: { logo_url: true }
  })
  if (clienteAtual?.logo_url) {
    try {
      const url = new URL(clienteAtual.logo_url)
      const chaveAntiga = url.pathname.replace(/^\//, '')
      await deletarArquivo(chaveAntiga)
    } catch { /* ignora erro ao deletar logo anterior */ }
  }

  const ext = arquivo.type === 'image/png' ? 'png' : arquivo.type === 'image/webp' ? 'webp' : 'jpg'
  const chave = `cliente-${payload.cliente_id}/logo/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const urlPublica = await uploadBuffer(chave, buffer, arquivo.type)

  await prisma.clientes.update({
    where: { id: payload.cliente_id },
    data: { logo_url: urlPublica }
  })

  return NextResponse.json({ logo_url: urlPublica })
}

// DELETE /api/cliente/logo — remove a logo do cliente
export async function DELETE() {
  const payload = await verificarSupervisor()
  if (!payload) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const cliente = await prisma.clientes.findUnique({
    where: { id: payload.cliente_id },
    select: { logo_url: true }
  })

  if (cliente?.logo_url) {
    try {
      const url = new URL(cliente.logo_url)
      const chave = url.pathname.replace(/^\//, '')
      await deletarArquivo(chave)
    } catch { /* ignora */ }
  }

  await prisma.clientes.update({
    where: { id: payload.cliente_id },
    data: { logo_url: null }
  })

  return NextResponse.json({ ok: true })
}
