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

// Fallback: detecta MIME pela extensão quando o browser não preenche
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
  'audio/webm': 'ogg', // WhatsApp compatível
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ erro: 'Arquivo não enviado.' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const contentType = file.type || EXT_MIME[ext] || ''

  if (!contentType) {
    return NextResponse.json({ erro: `Tipo de arquivo não suportado: .${ext}` }, { status: 400 })
  }

  const tipo = TIPOS_PERMITIDOS[contentType]
  if (!tipo) {
    return NextResponse.json({ erro: `Tipo não permitido: ${contentType}` }, { status: 400 })
  }

  const extFinal = EXT_OVERRIDE[contentType] ?? ext
  const chave = `chat-uploads/${randomUUID()}.${extFinal}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const urlPublica = await uploadBuffer(chave, buffer, contentType)

  return NextResponse.json({ urlPublica, tipo })
}
