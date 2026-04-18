'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import ModalRespostasRapidas from './ModalRespostasRapidas'
import { useLingua } from '@/contexts/LinguaContext'

interface Mensagem {
  id: number
  conteudo: string
  origem: string
  tipo: string | null
  url_midia: string | null
  enviado_em: string | null
}

interface RespostaRapida {
  id: number
  titulo: string
  tipo: string
  conteudo: string | null
  url_midia: string | null
  categoria: string | null
  atalho: string | null
}

interface Operador {
  id: number
  nome: string
  nivel: string | null
  ativo: boolean | null
}

interface Me {
  id: number
  nome: string
  nivel: string
}

interface Props {
  conversaId: number
}

const ORIGEM_ESTILO: Record<string, { alinhamento: string; bolha: string }> = {
  lead:     { alinhamento: 'items-start', bolha: 'bg-white border border-gray-200 text-gray-800' },
  ia:       { alinhamento: 'items-start', bolha: 'bg-blue-50 border border-blue-200 text-blue-900' },
  operador: { alinhamento: 'items-end',   bolha: 'bg-green-500 text-white' },
}

const ORIGEM_CHAVE: Record<string, string> = {
  lead:     'origemLead',
  ia:       'origemIA',
  operador: 'origemVoce',
}

const STATUS_COR: Record<string, string> = {
  aguardando:        'bg-yellow-100 text-yellow-800',
  em_atendimento:   'bg-blue-100 text-blue-800',
  aguardando_humano: 'bg-red-100 text-red-800',
  resolvida:        'bg-green-100 text-green-800',
}

const STATUS_CHAVE: Record<string, string> = {
  aguardando:        'statusAguardando',
  em_atendimento:   'statusEmAtendimento',
  aguardando_humano: 'statusEscalada',
  resolvida:        'statusResolvida',
}

function tocarSom() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.25)
    osc.onended = () => ctx.close()
  } catch {
    // bloqueado sem interação do usuário
  }
}

// Renderiza o conteúdo da mensagem (texto, imagem, documento, áudio, vídeo)
function ConteudoMensagem({ msg }: { msg: Mensagem }) {
  const isOperador = msg.origem === 'operador'

  if (msg.tipo === 'imagem' && msg.url_midia) {
    return (
      <div className="space-y-1">
        <a href={msg.url_midia} target="_blank" rel="noopener noreferrer">
          <img
            src={msg.url_midia}
            alt={msg.conteudo}
            className="max-w-[220px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          />
        </a>
        {msg.conteudo && msg.conteudo !== msg.url_midia && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.conteudo}</p>
        )}
      </div>
    )
  }

  if (msg.tipo === 'video' && msg.url_midia) {
    return (
      <video
        controls
        src={msg.url_midia}
        className="max-w-[260px] rounded-lg"
      />
    )
  }

  if (msg.tipo === 'audio' && msg.url_midia) {
    return <audio controls src={msg.url_midia} className="max-w-[240px]" />
  }

  if (msg.tipo === 'documento' && msg.url_midia) {
    return (
      <a
        href={msg.url_midia}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 text-sm underline underline-offset-2 ${isOperador ? 'text-white' : 'text-blue-700'}`}
      >
        <span className="text-lg">📄</span>
        <span className="truncate max-w-[180px]">{msg.conteudo}</span>
      </a>
    )
  }

  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.conteudo}</p>
}

let socket: Socket | null = null

export default function Chat({ conversaId }: Props) {
  const { tr } = useLingua()
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviandoArquivo, setEnviandoArquivo] = useState(false)
  const [status, setStatus] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [transferindo, setTransferindo] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function ajustarAltura() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  async function carregarMensagens() {
    const res = await fetch(`/api/conversas/${conversaId}/mensagens`)
    const data = await res.json()
    setMensagens(data)
  }

  async function carregarStatus() {
    const res = await fetch('/api/conversas')
    const lista = await res.json()
    const conversa = lista.find((c: { id: number; status: string }) => c.id === conversaId)
    if (conversa) setStatus(conversa.status ?? '')
  }

  async function zerarNaoLidas() {
    await fetch(`/api/conversas/${conversaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nao_lidas: 0 })
    })
  }

  useEffect(() => {
    carregarMensagens()
    carregarStatus()
    zerarNaoLidas()

    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then((data: Me | null) => {
        if (!data) return
        setMe(data)
        if (data.nivel === 'supervisor') {
          fetch('/api/operadores')
            .then(r => r.json())
            .then((ops: Operador[]) =>
              setOperadores(ops.filter(o => o.nivel === 'operador' && o.ativo))
            )
        }
      })

    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!)
    }

    socket.emit('join-conversa', conversaId)

    socket.on('nova-mensagem', (msg: Mensagem) => {
      if (msg.origem === 'lead' || msg.origem === 'ia') tocarSom()
      setMensagens(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })

    socket.on('status-alterado', (data: { conversaId: number; status: string }) => {
      if (data.conversaId === conversaId) setStatus(data.status)
    })

    return () => {
      socket?.emit('leave-conversa', conversaId)
      socket?.off('nova-mensagem')
      socket?.off('status-alterado')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function enviarConteudo(conteudo: string, tipo = 'texto', url_midia?: string) {
    if (tipo === 'texto' && !conteudo.trim()) return
    if (enviando) return
    setEnviando(true)

    const body: Record<string, string> = { conteudo, tipo }
    if (url_midia) body.url_midia = url_midia

    const res = await fetch(`/api/conversas/${conversaId}/mensagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (res.ok) {
      const nova = await res.json()
      setMensagens(prev => {
        if (prev.some(m => m.id === nova.id)) return prev
        return [...prev, nova]
      })
    }

    setEnviando(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    const conteudo = texto
    setTexto('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    await enviarConteudo(conteudo)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sozinho envia; Shift+Enter quebra linha
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    setEnviandoArquivo(true)

    try {
      // 1. Gera URL pré-assinada no R2
      const uploadRes = await fetch('/api/chat/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: arquivo.name, contentType: arquivo.type })
      })
      if (!uploadRes.ok) throw new Error('Erro ao preparar upload.')
      const { uploadUrl, urlPublica, tipo } = await uploadRes.json()

      // 2. Faz PUT direto no R2
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: arquivo,
        headers: { 'Content-Type': arquivo.type }
      })
      if (!putRes.ok) throw new Error('Erro ao enviar arquivo.')

      // 3. Envia mensagem com a URL da mídia
      await enviarConteudo(arquivo.name, tipo, urlPublica)
    } catch (err) {
      console.error('[upload]', err)
    } finally {
      setEnviandoArquivo(false)
      e.target.value = ''
    }
  }

  async function handleSelecionarResposta(resposta: RespostaRapida) {
    setModalAberto(false)
    if (resposta.url_midia) {
      await enviarConteudo(resposta.titulo, resposta.tipo, resposta.url_midia)
    } else {
      const conteudo = resposta.conteudo ?? ''
      if (!conteudo) return
      await enviarConteudo(conteudo)
    }
    textareaRef.current?.focus()
  }

  async function encerrar() {
    if (!confirm(tr('confirmarEncerrar'))) return
    setEncerrando(true)
    await fetch(`/api/conversas/${conversaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolvida' })
    })
    setStatus('resolvida')
    setEncerrando(false)
  }

  async function transferir(novoOperadorId: number) {
    const op = operadores.find(o => o.id === novoOperadorId)
    if (!op) return
    if (!confirm(`${tr('confirmarTransferencia')} ${op.nome}?`)) return
    setTransferindo(false)
    await fetch(`/api/conversas/${conversaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operador_id: novoOperadorId, status: 'em_atendimento' })
    })
  }

  const resolvida = status === 'resolvida'
  const statusCor = STATUS_COR[status] ?? 'bg-gray-100 text-gray-600'
  const statusLabel = STATUS_CHAVE[status] ? tr(STATUS_CHAVE[status]) : status
  const ocupado = enviando || enviandoArquivo

  return (
    <div className="flex flex-col flex-1 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-800">{tr('conversa')} #{conversaId}</h3>

        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusCor}`}>
            {statusLabel}
          </span>

          {me?.nivel === 'supervisor' && !resolvida && (
            transferindo ? (
              <div className="flex items-center gap-1">
                <select
                  autoFocus
                  defaultValue=""
                  onChange={e => e.target.value && transferir(Number(e.target.value))}
                  className="text-xs text-gray-900 border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="" disabled>{tr('selecionarOperador')}</option>
                  {operadores.map(op => (
                    <option key={op.id} value={op.id}>{op.nome}</option>
                  ))}
                </select>
                <button onClick={() => setTransferindo(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded">✕</button>
              </div>
            ) : (
              <button
                onClick={() => setTransferindo(true)}
                className="text-xs text-blue-600 border border-blue-200 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors"
              >
                {tr('transferirConversa')}
              </button>
            )
          )}

          {!resolvida && (
            <button
              onClick={encerrar}
              disabled={encerrando}
              className="text-xs text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              {tr('encerrarConversa')}
            </button>
          )}
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {mensagens.map(m => {
          const estilo = ORIGEM_ESTILO[m.origem] ?? ORIGEM_ESTILO.lead
          const label = ORIGEM_CHAVE[m.origem] ? tr(ORIGEM_CHAVE[m.origem]) : m.origem
          return (
            <div key={m.id} className={`flex flex-col gap-1 ${estilo.alinhamento}`}>
              <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm ${estilo.bolha}`}>
                <ConteudoMensagem msg={m} />
              </div>
              <span className="text-xs text-gray-400">
                {label} · {m.enviado_em
                  ? new Date(m.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : ''}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input ou banner de encerrada */}
      {resolvida ? (
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-center gap-2 text-sm text-gray-400">
          <span>✓</span>
          <span>{tr('conversaEncerrada')}</span>
        </div>
      ) : (
        <div className="bg-white border-t border-gray-200 px-4 py-3">
          {/* Barra de ferramentas */}
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-green-300 transition-colors"
            >
              <span>⚡</span>
              {tr('respostasRapidas')}
            </button>

            {/* Botão de anexo */}
            <button
              type="button"
              disabled={ocupado}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors disabled:opacity-50"
              title={tr('anexarArquivo')}
            >
              {enviandoArquivo
                ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
              }
              {tr('anexarArquivo')}
            </button>

            {/* Input de arquivo oculto */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,audio/*,video/mp4,video/webm"
              onChange={handleArquivo}
              className="hidden"
            />
          </div>

          {/* Textarea + enviar */}
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={e => { setTexto(e.target.value); ajustarAltura() }}
              onKeyDown={handleKeyDown}
              placeholder={tr('digiteMensagem')}
              rows={1}
              className="flex-1 border border-gray-300 rounded-2xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none leading-relaxed"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={ocupado || !texto.trim()}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors shrink-0"
            >
              {enviando
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                : tr('enviar')
              }
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-1.5 ml-1">Enter para enviar · Shift+Enter para nova linha</p>
        </div>
      )}

      {modalAberto && (
        <ModalRespostasRapidas
          onSelecionar={handleSelecionarResposta}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </div>
  )
}
