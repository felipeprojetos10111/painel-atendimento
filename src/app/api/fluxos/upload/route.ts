import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { uploadBuffer } from '@/lib/r2'
import { randomUUID } from 'crypto'

const TIPOS_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/aac': 'aac',
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
}

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', aac: 'audio/aac',
  m4a: 'audio/mp4',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
}

/**
 * POST /api/fluxos/upload
 * Recebe o arquivo como corpo binário (application/octet-stream).
 * Metadados via query: ?nome=arquivo.mp3&contentType=audio/mpeg
 * O arquivo passa pelo servidor e é enviado ao R2 via uploadBuffer (sem CORS).
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const payload = token ? await verifyToken(token) : null
  if (!payload || (payload.nivel !== 'supervisor' && payload.nivel !== 'super_admin'))
    return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })
  if (!payload.cliente_id)
    return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const nome = searchParams.get('nome') ?? 'arquivo'
  const ctParam = searchParams.get('contentType') ?? ''

  const ext = nome.split('.').pop()?.toLowerCase() ?? 'bin'
  const contentType: string = ctParam || EXT_MIME[ext] || ''

  if (!contentType)
    return NextResponse.json({ erro: `Tipo de arquivo não suportado: .${ext}` }, { status: 400 })

  const extFinal = TIPOS_PERMITIDOS[contentType] ?? ext
  if (!TIPOS_PERMITIDOS[contentType])
    return NextResponse.json({ erro: `Tipo não suportado: ${contentType}` }, { status: 400 })

  const arrayBuffer = await req.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const chave = `cliente-${payload.cliente_id}/fluxos/${randomUUID()}.${extFinal}`
  const publicUrl = await uploadBuffer(chave, buffer, contentType)

  return NextResponse.json({ publicUrl })
}
