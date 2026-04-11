import { NextRequest, NextResponse } from 'next/server'
import { gerarUrlUpload } from '@/lib/r2'
import { randomUUID } from 'crypto'

const TIPOS_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'imagem',
  'image/png': 'imagem',
  'image/webp': 'imagem',
  'image/gif': 'imagem',
  'audio/mpeg': 'audio',
  'audio/ogg': 'audio',
  'audio/wav': 'audio',
  'video/mp4': 'video',
  'video/webm': 'video',
  'application/pdf': 'documento',
  'application/msword': 'documento',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documento'
}

/**
 * POST /api/respostas-rapidas/upload
 * Body: { nome: string, contentType: string }
 * Retorna: { uploadUrl, chave, tipo, urlPublica }
 *
 * O frontend usa uploadUrl para fazer PUT direto no R2,
 * depois salva urlPublica ao criar a resposta rápida.
 */
export async function POST(req: NextRequest) {
  const { nome, contentType } = await req.json()

  if (!nome || !contentType) {
    return NextResponse.json({ erro: 'nome e contentType são obrigatórios.' }, { status: 400 })
  }

  const tipo = TIPOS_PERMITIDOS[contentType]
  if (!tipo) {
    return NextResponse.json({ erro: `Tipo de arquivo não permitido: ${contentType}` }, { status: 400 })
  }

  const ext = nome.split('.').pop() ?? 'bin'
  const chave = `respostas-rapidas/${randomUUID()}.${ext}`

  const uploadUrl = await gerarUrlUpload(chave, contentType)
  const urlPublica = `${process.env.R2_PUBLIC_URL}/${chave}`

  return NextResponse.json({ uploadUrl, chave, tipo, urlPublica })
}
