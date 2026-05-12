import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { gerarUrlUpload } from '@/lib/r2'
import { randomUUID } from 'crypto'

const TIPOS_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/aac': 'aac',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
}

/**
 * POST /api/fluxos/upload
 * Body: { contentType: string }
 * Retorna URL pré-assinada para PUT direto no R2 + URL pública final.
 * O frontend faz o PUT com o arquivo diretamente, sem passar pelo servidor.
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const payload = token ? await verifyToken(token) : null
  if (!payload || (payload.nivel !== 'supervisor' && payload.nivel !== 'super_admin'))
    return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })
  if (!payload.cliente_id)
    return NextResponse.json({ erro: 'Sem contexto de cliente' }, { status: 403 })

  const { contentType } = await req.json()
  const ext = TIPOS_PERMITIDOS[contentType]
  if (!ext)
    return NextResponse.json({ erro: `Tipo não suportado: ${contentType}` }, { status: 400 })

  const chave = `cliente-${payload.cliente_id}/fluxos/${randomUUID()}.${ext}`
  const uploadUrl = await gerarUrlUpload(chave, contentType)
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${chave}`

  return NextResponse.json({ uploadUrl, publicUrl })
}
