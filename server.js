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

  io.on('connection', (socket) => {
    socket.on('join-conversa', (conversaId) => {
      socket.join(`conversa-${conversaId}`)
    })

    socket.on('leave-conversa', (conversaId) => {
      socket.leave(`conversa-${conversaId}`)
    })
  })

  global.io = io

  const PORT = process.env.PORT || 3001
  httpServer.listen(PORT, () => {
    console.log(`Painel de atendimento rodando em http://localhost:${PORT}`)
  })
})
