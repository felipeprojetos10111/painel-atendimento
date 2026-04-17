import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

const PROMPT_PADRAO = `Você é um assistente de atendimento ao cliente prestativo e profissional. Analise a mensagem do lead e responda em JSON com os campos: resposta (mensagem para enviar ao lead), acao (resolver se você consegue ajudar sozinho, ou escalar se precisa de um humano), intencao (o que o lead quer em poucas palavras), urgencia (baixa, media ou alta). Sempre responda APENAS com JSON válido, sem texto adicional.`

async function verificarSupervisor() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.nivel !== 'supervisor') return null
  return payload
}

export async function GET() {
  const payload = await verificarSupervisor()
  if (!payload) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const config = await prisma.config_ia.findFirst()

  if (!config) {
    // Retorna padrão sem salvar — supervisor verá o formulário pré-preenchido
    return NextResponse.json({
      ativo: true,
      modo_distribuicao: 'ia',
      modelo: 'claude-sonnet-4-6',
      prompt_sistema: PROMPT_PADRAO,
      idioma_resposta: 'auto',
      max_rodadas: 5,
      criterios_escalacao: [],
      atualizado_em: null,
      atualizado_por: null,
    })
  }

  return NextResponse.json(config)
}

export async function PUT(req: NextRequest) {
  const payload = await verificarSupervisor()
  if (!payload) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await req.json()
  const { ativo, modo_distribuicao, modelo, prompt_sistema, idioma_resposta, max_rodadas, criterios_escalacao } = body

  if (!prompt_sistema?.trim()) {
    return NextResponse.json({ error: 'Prompt do sistema é obrigatório.' }, { status: 400 })
  }

  const modos = ['ia', 'balanceamento']
  const data = {
    ativo:               Boolean(ativo),
    modo_distribuicao:   modos.includes(modo_distribuicao) ? modo_distribuicao : 'ia',
    modelo:              String(modelo || 'claude-sonnet-4-6'),
    prompt_sistema:      String(prompt_sistema).trim(),
    idioma_resposta:     String(idioma_resposta || 'auto'),
    max_rodadas:         Number(max_rodadas) || 5,
    criterios_escalacao: Array.isArray(criterios_escalacao) ? criterios_escalacao.map(String) : [],
    atualizado_em:       new Date(),
    atualizado_por:      payload.nome,
  }

  const config = await prisma.config_ia.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  })

  return NextResponse.json(config)
}
