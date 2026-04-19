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
  'video/quicktime':   'video',
  'video/x-msvideo':   'video',
  'application/pdf':   'documento',
  'application/msword': 'documento',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documento',
}

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif',  webp: 'image/webp',
  mp3: 'audio/mpeg', ogg: 'audio/ogg',  wav: 'audio/wav',
  mp4: 'video/mp4',  webm: 'video/webm', mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

// Converte audio/webm para OGG/Opus — WhatsApp exige OGG/Opus
async function converterWebmParaOgg(buffer: Buffer): Promise<Buffer> {
  const tmpIn  = join(tmpdir(), `${randomUUID()}.webm`)
  const tmpOut = join(tmpdir(), `${randomUUID()}.ogg`)
  try {
    await writeFile(tmpIn, buffer)
    await new Promise<void>((resolve, reject) => {
      exec(`ffmpeg -y -i "${tmpIn}" -c:a libopus -f ogg "${tmpOut}"`, (err) => {
        if (err) reject(err); else resolve()
      })
    })
    return await readFile(tmpOut)
  } finally {
    await unlink(tmpIn).catch(() => {})
    await unlink(tmpOut).catch(() => {})
  }
}

// Converte qualquer vídeo para MP4 H.264 + AAC — WhatsApp não aceita MOV, AVI, WebM
async function converterVideoParaMp4(buffer: Buffer, extOrig: string): Promise<Buffer> {
  const tmpIn  = join(tmpdir(), `${randomUUID()}.${extOrig}`)
  const tmpOut = join(tmpdir(), `${randomUUID()}.mp4`)
  try {
    await writeFile(tmpIn, buffer)
    await new Promise<void>((resolve, reject) => {
      exec(
        `ffmpeg -y -i "${tmpIn}" -c:v libx264 -profile:v baseline -level 3.0 -c:a aac -movflags +faststart "${tmpOut}"`,
        (err) => { if (err) reject(err); else resolve() }
      )
    })
    return await readFile(tmpOut)
  } finally {
    await unlink(tmpIn).catch(() => {})
    await unlink(tmpOut).catch(() => {})
  }
}

// Aceita arquivo como corpo binário (application/octet-stream).
// Metadados passados via query: ?nome=arquivo.mp4&contentType=video/mp4
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const nome = searchParams.get('nome') ?? 'arquivo'
  const ctParam = searchParams.get('contentType') ?? ''

  const ext = nome.split('.').pop()?.toLowerCase() ?? 'bin'
  const contentType: string = ctParam || EXT_MIME[ext] || ''

  if (!contentType) {
    return NextResponse.json({ erro: `Tipo de arquivo não suportado: .${ext}` }, { status: 400 })
  }

  let tipo = TIPOS_PERMITIDOS[contentType]
  if (!tipo && contentType.startsWith('video/')) tipo = 'video'
  if (!tipo && contentType.startsWith('audio/')) tipo = 'audio'
  if (!tipo) {
    return NextResponse.json({ erro: `Tipo não permitido: ${contentType}` }, { status: 400 })
  }

  if (!process.env.R2_PUBLIC_URL) {
    return NextResponse.json({ erro: 'R2_PUBLIC_URL não configurado no servidor.' }, { status: 500 })
  }

  const arrayBuffer = await req.arrayBuffer()
  let buffer: Buffer = Buffer.from(arrayBuffer)
  let contentTypeFinal = contentType
  let extFinal = ext

  // Converte WebM de áudio → OGG/Opus
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

  // Converte vídeos → MP4 H.264 + AAC
  if (['video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mp4'].includes(contentType)) {
    try {
      buffer = await converterVideoParaMp4(buffer, ext)
      contentTypeFinal = 'video/mp4'
      extFinal = 'mp4'
      console.log('[upload] Vídeo convertido para MP4 H.264')
    } catch (err) {
      console.error('[upload] FFmpeg falhou ao converter vídeo:', err)
      return NextResponse.json({ erro: 'Falha ao converter vídeo. Tente com um arquivo menor ou no formato MP4.' }, { status: 500 })
    }
  }

  const chave = `chat-uploads/${randomUUID()}.${extFinal}`
  const urlPublica = await uploadBuffer(chave, buffer, contentTypeFinal)

  return NextResponse.json({ urlPublica, tipo })
}
