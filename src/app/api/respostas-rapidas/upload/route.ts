import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { uploadBuffer } from '@/lib/r2'
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
 * Body: multipart/form-data com campo "arquivo" (File)
 * Retorna: { tipo, urlPublica }
 *
 * O upload é feito server-side (sem CORS) usando uploadBuffer do r2.ts.
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const payload = token ? await verifyToken(token) : null
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const formData = await req.formData()
  const arquivo = formData.get('arquivo') as File | null

  if (!arquivo) {
    return NextResponse.json({ erro: 'Campo "arquivo" obrigatório.' }, { status: 400 })
  }

  const contentType = arquivo.type
  const tipo = TIPOS_PERMITIDOS[contentType]
  if (!tipo) {
    return NextResponse.json({ erro: `Tipo de arquivo não permitido: ${contentType}` }, { status: 400 })
  }

  const ext = arquivo.name.split('.').pop() ?? 'bin'
  const chave = `cliente-${payload.cliente_id}/respostas-rapidas/${randomUUID()}.${ext}`

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const urlPublica = await uploadBuffer(chave, buffer, contentType)

  return NextResponse.json({ tipo, urlPublica })
}
