import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { uploadBuffer } from '@/lib/r2'
import { randomUUID } from 'crypto'
import { exec } from 'child_process'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

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

// Converte audio/webm (container Matroska do browser) para OGG real via FFmpeg
async function converterWebmParaOgg(buffer: Buffer): Promise<Buffer> {
  const tmpIn  = join(tmpdir(), `${randomUUID()}.webm`)
  const tmpOut = join(tmpdir(), `${randomUUID()}.ogg`)
  try {
    await writeFile(tmpIn, buffer)
    await new Promise<void>((resolve, reject) => {
      exec(`ffmpeg -y -i "${tmpIn}" -c:a libopus -f ogg "${tmpOut}"`, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    return await readFile(tmpOut)
  } finally {
    await unlink(tmpIn).catch(() => {})
    await unlink(tmpOut).catch(() => {})
  }
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let buffer: any = Buffer.from(dados as string, 'base64')
  let contentTypeFinal = contentType
  let extFinal = ext

  // Converte WebM (gravado pelo browser) para OGG real — WhatsApp exige OGG/Opus
  if (contentType === 'audio/webm') {
    try {
      buffer = await converterWebmParaOgg(buffer)
      contentTypeFinal = 'audio/ogg'
      extFinal = 'ogg'
    } catch (err) {
      console.error('[upload] FFmpeg falhou ao converter áudio:', err)
      return NextResponse.json({ erro: 'Falha ao converter áudio.' }, { status: 500 })
    }
  }

  const chave = `chat-uploads/${randomUUID()}.${extFinal}`
  const urlPublica = await uploadBuffer(chave, buffer, contentTypeFinal)

  return NextResponse.json({ urlPublica, tipo })
}
