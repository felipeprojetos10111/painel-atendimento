'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface Mensagem {
  id: number
  conteudo: string
  origem: string
  enviado_em: string | null
}

interface Conversa {
  id: number
  status: string | null
  nao_lidas: number | null
  atualizado_em: string | null
  leads: { nome: string | null; telefone: string } | null
  operadores: { nome: string } | null
  mensagens: Mensagem[]
}

interface ToastEscalacao {
  id: string
  conversaId: number
  telefone: string
  intencao: string
  urgencia: string
}

interface Props {
  conversaSelecionada: number | null
  onSelecionar: (id: number) => void
}

const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  aguardando:        { label: 'Aguardando', cor: 'bg-yellow-100 text-yellow-800' },
  em_atendimento:   { label: 'Em atendimento', cor: 'bg-blue-100 text-blue-800' },
  aguardando_humano: { label: 'Escalada', cor: 'bg-red-100 text-red-800' },
  resolvida:        { label: 'Resolvida', cor: 'bg-green-100 text-green-800' }
}

let socket: Socket | null = null

export default function ListaConversas({ conversaSelecionada, onSelecionar }: Props) {
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [busca, setBusca] = useState('')
  const [toasts, setToasts] = useState<ToastEscalacao[]>([])
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  async function carregar() {
    const res = await fetch('/api/conversas')
    const data = await res.json()
    setConversas(data)
  }

  function adicionarToast(dados: Omit<ToastEscalacao, 'id'>) {
    const id = String(Date.now())
    setToasts(prev => [...prev, { ...dados, id }])
    timerRefs.current[id] = setTimeout(() => removerToast(id), 6000)
  }

  function removerToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id))
    clearTimeout(timerRefs.current[id])
    delete timerRefs.current[id]
  }

  useEffect(() => {
    carregar()

    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!)
    }

    socket.emit('join-operadores')

    socket.on('atualizar-lista', () => carregar())

    socket.on('nova-conversa-fila', (dados: Omit<ToastEscalacao, 'id'>) => {
      carregar()
      adicionarToast(dados)
    })

    return () => {
      socket?.off('atualizar-lista')
      socket?.off('nova-conversa-fila')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtradas = conversas.filter(c => {
    const termo = busca.toLowerCase()
    return (
      c.leads?.telefone.includes(termo) ||
      c.leads?.nome?.toLowerCase().includes(termo) ||
      c.status?.includes(termo)
    )
  })

  return (
    <aside className="w-80 flex flex-col border-r border-gray-200 bg-white relative">
      {/* Toasts de escalação */}
      <div className="absolute top-2 left-2 right-2 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="bg-red-600 text-white text-xs rounded-lg px-3 py-2.5 shadow-lg pointer-events-auto flex items-start justify-between gap-2"
          >
            <div>
              <p className="font-semibold mb-0.5">🚨 Conversa escalada para humano</p>
              <p className="opacity-90">{toast.telefone} — {toast.intencao}</p>
              <p className="opacity-75 capitalize">Urgência: {toast.urgencia}</p>
            </div>
            <button
              onClick={() => { removerToast(toast.id); onSelecionar(toast.conversaId) }}
              className="shrink-0 underline opacity-90 hover:opacity-100 text-xs"
            >
              Ver
            </button>
          </div>
        ))}
      </div>

      <div className="p-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Conversas</h2>
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {filtradas.length === 0 && (
          <li className="p-4 text-sm text-gray-400 text-center">Nenhuma conversa encontrada.</li>
        )}
        {filtradas.map(c => {
          const status = STATUS_LABEL[c.status ?? ''] ?? { label: c.status ?? '', cor: 'bg-gray-100 text-gray-600' }
          const ultimaMensagem = c.mensagens[0]
          const nome = c.leads?.nome ?? c.leads?.telefone ?? 'Desconhecido'
          const naoLidas = c.nao_lidas ?? 0

          return (
            <li
              key={c.id}
              onClick={() => onSelecionar(c.id)}
              className={`flex flex-col gap-1 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                conversaSelecionada === c.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 truncate max-w-[140px]">{nome}</span>
                <div className="flex items-center gap-1.5">
                  {naoLidas > 0 && conversaSelecionada !== c.id && (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {naoLidas > 99 ? '99+' : naoLidas}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cor}`}>
                    {status.label}
                  </span>
                </div>
              </div>
              {ultimaMensagem && (
                <p className={`text-xs truncate ${naoLidas > 0 && conversaSelecionada !== c.id ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                  <span>{ultimaMensagem.origem === 'lead' ? '👤' : ultimaMensagem.origem === 'ia' ? '🤖' : '🧑‍💼'}</span>{' '}
                  {ultimaMensagem.conteudo}
                </p>
              )}
              <span className="text-xs text-gray-400">
                {c.atualizado_em ? new Date(c.atualizado_em).toLocaleString('pt-BR') : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
