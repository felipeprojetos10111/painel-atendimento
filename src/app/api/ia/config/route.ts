import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

const PROMPT_PADRAO = 'Você é um assistente de atendimento ao cliente prestativo e profissional.'

async function verificarSupervisor() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.nivel !== 'supervisor' || !payload.cliente_id) return null
  return payload as typeof payload & { cliente_id: number }
}

export async function GET() {
  const payload = await verificarSupervisor()
  if (!payload) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const config = await prisma.config_ia.findFirst({
    where: { cliente_id: payload.cliente_id }
  })

  if (!config) {
    return NextResponse.json({
      ativo: true,
      modo_distribuicao: 'ia',
      modelo: 'claude-sonnet-4-6',
      prompt_sistema: PROMPT_PADRAO,
      idioma_resposta: 'auto',
      max_rodadas: 5,
      criterios_escalacao: [],
      ia_provedor: 'anthropic',
      ia_api_key: null,
      atualizado_em: null,
      atualizado_por: null,
    })
  }

  // Não expõe a chave de API completa — retorna apenas se está configurada
  return NextResponse.json({
    ...config,
    ia_api_key: config.ia_api_key ? '••••••••' : null,
  })
}

export async function PUT(req: NextRequest) {
  const payload = await verificarSupervisor()
  if (!payload) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await req.json()
  const { ativo, prompt_sistema, ia_provedor, ia_api_key } = body

  if (!prompt_sistema?.trim()) {
    return NextResponse.json({ error: 'Prompt do sistema é obrigatório.' }, { status: 400 })
  }

  const data: Record<string, unknown> = {
    ativo:          Boolean(ativo),
    prompt_sistema: String(prompt_sistema).trim(),
    atualizado_em:  new Date(),
    atualizado_por: payload.nome,
  }

  if (ia_provedor) data.ia_provedor = ia_provedor
  // Só atualiza a chave se foi enviada e não é máscara
  if (ia_api_key && ia_api_key !== '••••••••') data.ia_api_key = ia_api_key

  const config = await prisma.config_ia.upsert({
    where:  { cliente_id: payload.cliente_id },
    update: data,
    create: {
      cliente_id:          payload.cliente_id,
      ativo:               Boolean(ativo),
      prompt_sistema:      String(prompt_sistema).trim(),
      atualizado_em:       new Date(),
      atualizado_por:      payload.nome,
      modo_distribuicao:   'ia',
      modelo:              'claude-sonnet-4-6',
      idioma_resposta:     'auto',
      max_rodadas:         5,
      criterios_escalacao: [],
      ia_provedor:         (ia_provedor as string) || 'anthropic',
      ...(ia_api_key && ia_api_key !== '••••••••' && { ia_api_key }),
    },
  })

  return NextResponse.json({
    ativo:          config.ativo,
    prompt_sistema: config.prompt_sistema,
    ia_provedor:    config.ia_provedor,
    ia_api_key:     config.ia_api_key ? '••••••••' : null,
    atualizado_em:  config.atualizado_em,
    atualizado_por: config.atualizado_por,
  })
}
