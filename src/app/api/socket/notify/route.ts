import { NextRequest, NextResponse } from 'next/server'

// POST /api/socket/notify
// Chamado internamente pelo whatsapp-gateway para emitir eventos Socket.io
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')

  if (!process.env.INTERNAL_SECRET || secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { evento, sala, dados } = body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const io = (global as any).io as import('socket.io').Server | undefined

  if (!io) {
    return NextResponse.json({ erro: 'Socket.io não disponível' }, { status: 503 })
  }

  if (sala) {
    io.to(sala).emit(evento, dados)
  } else {
    io.emit(evento, dados)
  }

  return NextResponse.json({ ok: true })
}
