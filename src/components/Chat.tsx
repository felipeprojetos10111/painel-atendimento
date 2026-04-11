'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import ModalRespostasRapidas from './ModalRespostasRapidas'

interface Mensagem {
  id: number
  conteudo: string
  origem: string
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

interface Props {
  conversaId: number
}

const ORIGEM_CONFIG: Record<string, { label: string; alinhamento: string; bolha: string }> = {
  lead:     { label: 'Lead',  alinhamento: 'items-start', bolha: 'bg-white border border-gray-200 text-gray-800' },
  ia:       { label: 'IA',   alinhamento: 'items-start', bolha: 'bg-blue-50 border border-blue-200 text-blue-900' },
  operador: { label: 'Você', alinhamento: 'items-end',   bolha: 'bg-green-500 text-white' }
}

let socket: Socket | null = null

export default function Chat({ conversaId }: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [status, setStatus] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    carregarMensagens()
    carregarStatus()

    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!)
    }

    socket.emit('join-conversa', conversaId)

    socket.on('nova-mensagem', (msg: Mensagem) => {
      setMensagens(prev => [...prev, msg])
    })

    return () => {
      socket?.emit('leave-conversa', conversaId)
      socket?.off('nova-mensagem')
    }
  }, [conversaId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function enviarConteudo(conteudo: string) {
    if (!conteudo.trim() || enviando) return
    setEnviando(true)

    const res = await fetch(`/api/conversas/${conversaId}/mensagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudo: conteudo.trim() })
    })

    if (res.ok) {
      const nova = await res.json()
      setMensagens(prev => [...prev, nova])
    }

    setEnviando(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await enviarConteudo(texto)
    setTexto('')
  }

  async function handleSelecionarResposta(resposta: RespostaRapida) {
    setModalAberto(false)
    const conteudo = resposta.conteudo ?? resposta.url_midia ?? ''
    if (!conteudo) return
    await enviarConteudo(conteudo)
    inputRef.current?.focus()
  }

  async function atualizarStatus(novoStatus: string) {
    await fetch(`/api/conversas/${conversaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus })
    })
    setStatus(novoStatus)
  }

  return (
    <div className="flex flex-col flex-1 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-800">Conversa #{conversaId}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Status:</span>
          <select
            value={status}
            onChange={e => atualizarStatus(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="aguardando">Aguardando</option>
            <option value="em_atendimento">Em atendimento</option>
            <option value="aguardando_humano">Escalada</option>
            <option value="resolvida">Resolvida</option>
          </select>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {mensagens.map(m => {
          const cfg = ORIGEM_CONFIG[m.origem] ?? ORIGEM_CONFIG.lead
          return (
            <div key={m.id} className={`flex flex-col gap-1 ${cfg.alinhamento}`}>
              <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${cfg.bolha}`}>
                <p className="leading-relaxed">{m.conteudo}</p>
              </div>
              <span className="text-xs text-gray-400">
                {cfg.label} · {m.enviado_em
                  ? new Date(m.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : ''}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        {/* Barra de ações acima do input */}
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-green-300 transition-colors"
          >
            <span>⚡</span>
            Respostas rápidas
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors shrink-0"
          >
            {enviando
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
            }
          </button>
        </form>
      </div>

      {/* Modal de Respostas Rápidas */}
      {modalAberto && (
        <ModalRespostasRapidas
          onSelecionar={handleSelecionarResposta}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </div>
  )
}
