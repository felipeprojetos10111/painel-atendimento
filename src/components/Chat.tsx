'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import ModalRespostasRapidas from './ModalRespostasRapidas'
import { useLingua } from '@/contexts/LinguaContext'

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

// Toca um bip curto via Web Audio API
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
    // Navegador pode bloquear sem interação do usuário
  }
}

let socket: Socket | null = null

export default function Chat({ conversaId }: Props) {
  const { tr } = useLingua()
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [status, setStatus] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [transferindo, setTransferindo] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
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

    // Carrega dados do usuário atual
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then((data: Me | null) => {
        if (!data) return
        setMe(data)
        // Supervisores carregam lista de operadores para transferência
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
      if (msg.origem === 'lead' || msg.origem === 'ia') {
        tocarSom()
      }
      setMensagens(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })

    // Atualiza status quando outra pessoa encerra ou transfere a conversa
    socket.on('status-alterado', (data: { conversaId: number; status: string }) => {
      if (data.conversaId === conversaId) {
        setStatus(data.status)
      }
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

  return (
    <div className="flex flex-col flex-1 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-800">{tr('conversa')} #{conversaId}</h3>

        <div className="flex items-center gap-2">
          {/* Badge de status (somente leitura) */}
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusCor}`}>
            {statusLabel}
          </span>

          {/* Transferir — somente supervisor, conversa não resolvida */}
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
                <button
                  onClick={() => setTransferindo(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded"
                >
                  ✕
                </button>
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

          {/* Encerrar — conversa não resolvida */}
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
              <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${estilo.bolha}`}>
                <p className="leading-relaxed">{m.conteudo}</p>
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
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-green-300 transition-colors"
            >
              <span>⚡</span>
              {tr('respostasRapidas')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder={tr('digiteMensagem')}
              className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="submit"
              disabled={enviando || !texto.trim()}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors shrink-0"
            >
              {enviando
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                : tr('enviar')
              }
            </button>
          </form>
        </div>
      )}

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
