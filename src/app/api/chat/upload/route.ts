import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { gerarUrlUpload } from '@/lib/r2'
import { randomUUID } from 'crypto'

const TIPOS_PERMITIDOS: Record<string, string> = {
  'image/jpeg':        'imagem',
  'image/png':         'imagem',
  'image/webp':        'imagem',
  'image/gif':         'imagem',
  'audio/mpeg':        'audio',
  'audio/ogg':         'audio',
  'audio/wav':         'audio',
  'audio/webm':        'audio',
  'video/mp4':         'video',
  'video/webm':        'video',
  'application/pdf':   'documento',
  'application/msword': 'documento',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documento',
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })

  const { nome, contentType } = await req.json()
  if (!nome || !contentType) {
    return NextResponse.json({ erro: 'nome e contentType são obrigatórios.' }, { status: 400 })
  }

  const tipo = TIPOS_PERMITIDOS[contentType]
  if (!tipo) {
    return NextResponse.json({ erro: `Tipo não permitido: ${contentType}` }, { status: 400 })
  }

  // áudio gravado pelo browser vem como audio/webm → usa extensão .ogg (WhatsApp compatível)
  const extMap: Record<string, string> = { 'audio/webm': 'ogg' }
  const ext = extMap[contentType] ?? (nome.split('.').pop() || 'bin')
  const chave = `chat-uploads/${randomUUID()}.${ext}`

  const uploadUrl = await gerarUrlUpload(chave, contentType)
  const urlPublica = `${process.env.R2_PUBLIC_URL}/${chave}`

  return NextResponse.json({ uploadUrl, chave, tipo, urlPublica })
}
