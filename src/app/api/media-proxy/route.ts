import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

/**
 * GET /api/media-proxy?url=<encoded_url>
 *
 * Proxy autenticado para mídias recebidas do WhatsApp (lookaside.fbsbx.com).
 *
 * As URLs do WhatsApp são assinadas com o token ativo no momento em que foram
 * salvas. Se o token mudar depois, a URL original retorna 401. Nesse caso,
 * extraímos o media_id da URL e buscamos uma URL fresca via Graph API.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload) return new NextResponse('Não autenticado', { status: 401 })
  if (!payload.cliente_id) return new NextResponse('Sem contexto de cliente', { status: 403 })

  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('Parâmetro url obrigatório', { status: 400 })

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

  // Busca credenciais do cliente logado
  const cliente = await prisma.clientes.findUnique({
    where: { id: payload.cliente_id },
    select: { whatsapp_token: true, phone_number_id: true }
  })

  if (!cliente?.whatsapp_token) {
    return new NextResponse('Token WhatsApp não configurado', { status: 500 })
  }

  const waToken = cliente.whatsapp_token

  try {
    // 1ª tentativa: usa a URL armazenada diretamente
    let downloadUrl = decoded
    let mediaRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${waToken}` },
    })

    // Se 401 → URL assinada com token antigo → busca URL fresca via Graph API
    if (mediaRes.status === 401) {
      const mid = extrairMediaId(decoded)
      if (mid) {
        console.log(`[media-proxy] URL expirada, buscando URL fresca para mid=${mid}`)
        const graphRes = await fetch(
          `https://graph.facebook.com/v18.0/${mid}`,
          { headers: { Authorization: `Bearer ${waToken}` } }
        )
        if (graphRes.ok) {
          const data = await graphRes.json() as { url?: string }
          if (data.url) {
            downloadUrl = data.url
            mediaRes = await fetch(downloadUrl, {
              headers: { Authorization: `Bearer ${waToken}` },
            })
          }
        }
      }
    }

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
    console.error('[media-proxy] Erro:', err)
    return new NextResponse('Erro interno', { status: 500 })
  }
}

/**
 * Extrai o media_id do parâmetro `mid` de uma URL do WhatsApp.
 * Exemplo: lookaside.fbsbx.com/...?mid=1489494539640785&...  → "1489494539640785"
 */
function extrairMediaId(url: string): string | null {
  try {
    const u = new URL(url)
    return u.searchParams.get('mid')
  } catch {
    return null
  }
}
