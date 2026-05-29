import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

/**
 * GET /api/media-proxy?url=<encoded_url>
 *
 * Proxy autenticado para mídias recebidas do WhatsApp (lookaside.fbsbx.com).
 * O browser não consegue acessar essas URLs diretamente (401) porque precisam
 * do token Bearer. Este endpoint busca a mídia com o token do cliente e
 * repassa os bytes ao browser.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload) return new NextResponse('Não autenticado', { status: 401 })
  if (!payload.cliente_id) return new NextResponse('Sem contexto de cliente', { status: 403 })

  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('Parâmetro url obrigatório', { status: 400 })

  // Só faz proxy de URLs do Facebook/WhatsApp por segurança
  let decoded: string
  try {
    decoded = decodeURIComponent(url)
  } catch {
    return new NextResponse('URL inválida', { status: 400 })
  }

  const isFbUrl = decoded.includes('lookaside.fbsbx.com') ||
                  decoded.includes('graph.facebook.com') ||
                  decoded.includes('cdn.fbsbx.com')

  if (!isFbUrl) {
    // URL já pública (R2, etc) — redireciona diretamente
    return NextResponse.redirect(decoded)
  }

  // Busca o whatsapp_token do cliente logado
  const cliente = await prisma.clientes.findUnique({
    where: { id: payload.cliente_id },
    select: { whatsapp_token: true }
  })

  if (!cliente?.whatsapp_token) {
    return new NextResponse('Token WhatsApp não configurado', { status: 500 })
  }

  try {
    const mediaRes = await fetch(decoded, {
      headers: { Authorization: `Bearer ${cliente.whatsapp_token}` },
    })

    if (!mediaRes.ok) {
      return new NextResponse(`Erro ao buscar mídia: ${mediaRes.status}`, { status: mediaRes.status })
    }

    const contentType = mediaRes.headers.get('content-type') ?? 'application/octet-stream'
    const buffer = await mediaRes.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': buffer.byteLength.toString(),
      },
    })
  } catch (err) {
    console.error('[media-proxy] Erro ao buscar mídia:', err)
    return new NextResponse('Erro interno', { status: 500 })
  }
}
