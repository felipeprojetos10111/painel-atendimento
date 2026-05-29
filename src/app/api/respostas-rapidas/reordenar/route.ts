import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

async function getPayload() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

/**
 * PATCH /api/respostas-rapidas/reordenar
 * Body: { ids: number[] }  — array de IDs na nova ordem desejada
 * Atualiza o campo `ordem` de cada resposta do operador logado.
 */
export async function PATCH(req: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { ids } = await req.json() as { ids: number[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ erro: 'ids obrigatório' }, { status: 400 })
  }

  // Atualiza cada ID com sua posição no array (somente respostas do operador)
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.respostas_rapidas.updateMany({
        where: { id, operador_id: payload.id },
        data:  { ordem: index },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
