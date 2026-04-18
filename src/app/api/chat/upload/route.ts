import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { uploadBuffer } from '@/lib/r2'
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

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif',  webp: 'image/webp',
  mp3: 'audio/mpeg', ogg: 'audio/ogg',  wav: 'audio/wav',
  mp4: 'video/mp4',  webm: 'video/webm',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

const EXT_OVERRIDE: Record<string, string> = {
  'audio/webm': 'ogg',
}

// WhatsApp não aceita audio/webm — força content-type compatível ao salvar no R2
const CONTENT_TYPE_OVERRIDE: Record<string, string> = {
  'audio/webm': 'audio/ogg',
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })

  // Recebe { nome, contentType, dados } onde dados é base64
  const { nome, contentType: ct, dados } = await req.json()

  if (!nome || !dados) {
    return NextResponse.json({ erro: 'nome e dados são obrigatórios.' }, { status: 400 })
  }

  const ext = (nome as string).split('.').pop()?.toLowerCase() ?? 'bin'
  const contentType: string = ct || EXT_MIME[ext] || ''

  if (!contentType) {
    return NextResponse.json({ erro: `Tipo de arquivo não suportado: .${ext}` }, { status: 400 })
  }

  const tipo = TIPOS_PERMITIDOS[contentType]
  if (!tipo) {
    return NextResponse.json({ erro: `Tipo não permitido: ${contentType}` }, { status: 400 })
  }

  if (!process.env.R2_PUBLIC_URL) {
    return NextResponse.json({ erro: 'R2_PUBLIC_URL não configurado no servidor.' }, { status: 500 })
  }

  const extFinal = EXT_OVERRIDE[contentType] ?? ext
  const chave = `chat-uploads/${randomUUID()}.${extFinal}`
  const contentTypeFinal = CONTENT_TYPE_OVERRIDE[contentType] ?? contentType

  const buffer = Buffer.from(dados as string, 'base64')
  const urlPublica = await uploadBuffer(chave, buffer, contentTypeFinal)

  return NextResponse.json({ urlPublica, tipo })
}
