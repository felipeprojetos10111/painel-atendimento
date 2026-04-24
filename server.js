// Carrega variáveis de ambiente antes de qualquer coisa
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(process.cwd())

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: { origin: '*' }
  })

  // Map<operadorId, socketId> — presença em tempo real
  const onlineOperators = new Map()

  io.on('connection', (socket) => {
    socket.on('join-conversa', (conversaId) => {
      socket.join(`conversa-${conversaId}`)
    })

    socket.on('leave-conversa', (conversaId) => {
      socket.leave(`conversa-${conversaId}`)
    })

    socket.on('join-operadores', () => {
      socket.join('operadores')
    })

    socket.on('operador-online', (operadorId) => {
      onlineOperators.set(operadorId, socket.id)
      console.log(`[presença] operador ${operadorId} online (socket ${socket.id})`)

      // Tenta atribuir conversas pendentes sem operador ao novo operador online
      const secret = process.env.INTERNAL_SECRET
      if (secret) {
        const port = process.env.PORT || 3001
        fetch(`http://localhost:${port}/api/fila/processar-pendentes`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
          body:    JSON.stringify({ operadorId })
        }).catch(err => console.error('[presença] Erro ao processar pendentes:', err.message))
      }
    })

    socket.on('disconnect', () => {
      for (const [operadorId, socketId] of onlineOperators.entries()) {
        if (socketId === socket.id) {
          onlineOperators.delete(operadorId)
          console.log(`[presença] operador ${operadorId} offline`)
          break
        }
      }
    })
  })

  global.io = io
  global.onlineOperators = onlineOperators

  // Evita timeout em uploads grandes + conversão FFmpeg (padrão Node.js é 300s)
  httpServer.requestTimeout = 600000  // 10 minutos
  httpServer.headersTimeout = 620000

  const PORT = process.env.PORT || 3001
  httpServer.listen(PORT, () => {
    console.log(`Painel de atendimento rodando em http://localhost:${PORT}`)
    console.log(`DATABASE_URL carregado: ${process.env.DATABASE_URL ? 'sim' : 'NÃO'}`)
  })
})
