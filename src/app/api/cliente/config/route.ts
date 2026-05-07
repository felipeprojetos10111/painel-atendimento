import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

const MASCARA = '••••••••'

async function verificarSupervisor() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.nivel !== 'supervisor' || !payload.cliente_id) return null
  return payload as typeof payload & { cliente_id: number }
}

// GET /api/cliente/config — retorna credenciais do cliente (mascaradas)
export async function GET() {
  const payload = await verificarSupervisor()
  if (!payload) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const cliente = await prisma.clientes.findUnique({
    where: { id: payload.cliente_id },
    select: {
      id: true,
      nome: true,
      slug: true,
      whatsapp_token: true,
      phone_number_id: true,
      app_secret: true,
      verify_token: true,
      ia_api_key: true,
      webhook_secret: true,
      plataforma_base_url: true,
      logo_url: true,
    }
  })

  if (!cliente) return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 })

  return NextResponse.json({
    id:              cliente.id,
    nome:            cliente.nome,
    slug:            cliente.slug,
    phone_number_id: cliente.phone_number_id ?? '',
    verify_token:    cliente.verify_token ?? '',
    webhook_secret:  cliente.webhook_secret ?? '',
    plataforma_base_url: cliente.plataforma_base_url ?? '',
    logo_url:        cliente.logo_url ?? '',
    // campos sensíveis — só indica se estão preenchidos
    whatsapp_token: cliente.whatsapp_token ? MASCARA : '',
    app_secret:     cliente.app_secret     ? MASCARA : '',
    ia_api_key:     cliente.ia_api_key     ? MASCARA : '',
  })
}

// PUT /api/cliente/config — atualiza credenciais do cliente
export async function PUT(req: NextRequest) {
  const payload = await verificarSupervisor()
  if (!payload) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 })

  const body = await req.json()
  const data: Record<string, string | null> = {}

  if (body.phone_number_id    !== undefined) data.phone_number_id    = body.phone_number_id    || null
  if (body.verify_token       !== undefined) data.verify_token       = body.verify_token       || null
  if (body.plataforma_base_url !== undefined) data.plataforma_base_url = body.plataforma_base_url || null

  // Só atualiza campos sensíveis se enviados e não forem a máscara
  if (body.whatsapp_token && body.whatsapp_token !== MASCARA) data.whatsapp_token = body.whatsapp_token
  if (body.app_secret     && body.app_secret     !== MASCARA) data.app_secret     = body.app_secret
  if (body.ia_api_key     && body.ia_api_key     !== MASCARA) data.ia_api_key     = body.ia_api_key

  // Permite apagar campos sensíveis enviando string vazia explicitamente
  if (body.whatsapp_token === '') data.whatsapp_token = null
  if (body.app_secret     === '') data.app_secret     = null
  if (body.ia_api_key     === '') data.ia_api_key     = null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ erro: 'Nenhum campo para atualizar.' }, { status: 400 })
  }

  const cliente = await prisma.clientes.update({
    where: { id: payload.cliente_id },
    data,
    select: {
      id: true,
      nome: true,
      slug: true,
      phone_number_id: true,
      verify_token: true,
      whatsapp_token: true,
      app_secret: true,
      ia_api_key: true,
      webhook_secret: true,
      plataforma_base_url: true,
    }
  })

  return NextResponse.json({
    id:              cliente.id,
    nome:            cliente.nome,
    slug:            cliente.slug,
    phone_number_id: cliente.phone_number_id ?? '',
    verify_token:    cliente.verify_token ?? '',
    webhook_secret:  cliente.webhook_secret ?? '',
    plataforma_base_url: cliente.plataforma_base_url ?? '',
    whatsapp_token: cliente.whatsapp_token ? MASCARA : '',
    app_secret:     cliente.app_secret     ? MASCARA : '',
    ia_api_key:     cliente.ia_api_key     ? MASCARA : '',
  })
}
