import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Rota pública de redirect — mascara o link de afiliado do broker
// Ex: mypainel.site/r/327cbd0f0df3 → broker.worbit.io/auth/register?...&affiliateLinkId=327cbd0f0df3

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params

  const link = await prisma.links_enviados.findFirst({
    where: { codigo },
    select: {
      clientes: { select: { plataforma_base_url: true } }
    }
  })

  const baseUrl = link?.clientes?.plataforma_base_url ?? ''

  if (!baseUrl) {
    // Código não encontrado ou cliente sem URL configurada — redireciona para raiz
    return NextResponse.redirect(new URL('/', req.url), { status: 302 })
  }

  // Reconstrói a URL completa do broker com o código de rastreamento
  const sep = baseUrl.endsWith('=') || baseUrl.endsWith('/') ? '' : '/'
  const destino = baseUrl + sep + codigo

  return NextResponse.redirect(destino, { status: 302 })
}
