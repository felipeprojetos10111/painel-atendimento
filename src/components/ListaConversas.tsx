'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useLingua } from '@/contexts/LinguaContext'
import AvatarOperador from './AvatarOperador'

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
  janela_expirada: boolean
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

const STATUS_COR: Record<string, string> = {
  aguardando:        'bg-yellow-900/30 text-yellow-400 border border-yellow-700/30',
  em_atendimento:   'bg-blue-900/30 text-blue-400 border border-blue-700/30',
  aguardando_humano: 'bg-red-900/30 text-red-400 border border-red-700/30',
  resolvida:        'bg-green-900/30 text-green-400 border border-green-700/30',
}

const STATUS_CHAVE: Record<string, string> = {
  aguardando:        'statusAguardando',
  em_atendimento:   'statusEmAtendimento',
  aguardando_humano: 'statusEscalada',
  resolvida:        'statusResolvida',
}

function formatarHorario(dataStr: string): string {
  const data = new Date(dataStr)
  const agora = new Date()
  const hoje = agora.toDateString() === data.toDateString()
  if (hoje) {
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function ItemConversa({
  c, selecionada, onSelecionar, tr, expirada = false
}: {
  c: Conversa
  selecionada: boolean
  onSelecionar: (id: number) => void
  tr: (key: string) => string
  expirada?: boolean
}) {
  const statusCor = STATUS_COR[c.status ?? ''] ?? 'bg-gray-100 text-gray-600'
  const statusLabel = STATUS_CHAVE[c.status ?? ''] ? tr(STATUS_CHAVE[c.status!]) : (c.status ?? '')
  const ultimaMensagem = c.mensagens[0]
  const nome = c.leads?.nome ?? c.leads?.telefone ?? 'Desconhecido'
  const naoLidas = c.nao_lidas ?? 0

  return (
    <li
      onClick={() => onSelecionar(c.id)}
      className={`flex flex-col gap-1 px-4 py-3 cursor-pointer hover:bg-[#202c33] transition-colors ${
        selecionada ? 'bg-[#202c33] border-l-4 border-l-[#00a884]' : ''
      } ${expirada ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#e9edef] truncate max-w-[140px]">{nome}</span>
        <div className="flex items-center gap-1.5">
          {naoLidas > 0 && !selecionada && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {naoLidas > 99 ? '99+' : naoLidas}
            </span>
          )}
          {expirada
            ? <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#202c33] text-[#8696a0]">⏱ Expirada</span>
            : <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCor}`}>{statusLabel}</span>
          }
        </div>
      </div>
      {ultimaMensagem && (
        <p className={`text-xs truncate ${naoLidas > 0 && !selecionada ? 'text-[#e9edef] font-medium' : 'text-[#8696a0]'}`}>
          <span>{ultimaMensagem.origem === 'lead' ? '👤' : ultimaMensagem.origem === 'ia' ? '🤖' : '🧑‍💼'}</span>{' '}
          {ultimaMensagem.conteudo}
        </p>
      )}
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs text-[#3b4a54]">
          {c.atualizado_em ? formatarHorario(c.atualizado_em) : ''}
        </span>
        {c.operadores?.nome ? (
          <div className="flex items-center gap-1.5 shrink-0 min-w-0" title={`${tr('atendidoPor')} ${c.operadores.nome}`}>
            <AvatarOperador nome={c.operadores.nome} tamanho="xs" />
            <span className="text-xs text-[#8696a0] font-medium truncate max-w-[90px]">
              {c.operadores.nome.split(' ')[0]}
            </span>
          </div>
        ) : ultimaMensagem?.origem === 'ia' ? (
          <span className="text-xs text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded-full shrink-0">
            🤖 {tr('respondendoIA')}
          </span>
        ) : c.status === 'aguardando_humano' ? (
          <span className="text-xs text-orange-400 bg-orange-900/30 px-1.5 py-0.5 rounded-full shrink-0">
            ⏳ {tr('aguardandoFila')}
          </span>
        ) : null}
      </div>
    </li>
  )
}

let socket: Socket | null = null

export default function ListaConversas({ conversaSelecionada, onSelecionar }: Props) {
  const { tr } = useLingua()
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [busca, setBusca] = useState('')
  const [expiradaAberta, setExpiradaAberta] = useState(false)
  const [toasts, setToasts] = useState<ToastEscalacao[]>([])
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const operadorIdRef = useRef<number | null>(null)

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

    // Busca dados do operador atual para registrar presença
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(me => {
        if (!me) return
        operadorIdRef.current = me.id

        if (!socket) {
          socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!)
        }

        socket.emit('join-operadores')

        // Registra presença — supervisores também emitem, mas /api/fila/atribuir os ignora
        socket.emit('operador-online', me.id)

        socket.on('atualizar-lista', () => carregar())
        socket.on('nova-conversa-fila', (dados: Omit<ToastEscalacao, 'id'>) => {
          carregar()
          adicionarToast(dados)
        })
        socket.on('conversa-atribuida', () => carregar())
      })

    return () => {
      socket?.off('atualizar-lista')
      socket?.off('nova-conversa-fila')
      socket?.off('conversa-atribuida')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const todasFiltradas = conversas.filter(c => {
    const termo = busca.toLowerCase()
    return (
      !termo ||
      c.leads?.telefone.includes(termo) ||
      c.leads?.nome?.toLowerCase().includes(termo)
    )
  })

  const filtradas  = todasFiltradas.filter(c => !c.janela_expirada)
  const expiradas  = todasFiltradas.filter(c =>  c.janela_expirada)

  return (
    <aside className="w-80 flex flex-col border-r border-[#2a3942] bg-[#111b21] relative">
      {/* Toasts de escalação */}
      <div className="absolute top-2 left-2 right-2 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="bg-red-600 text-white text-xs rounded-lg px-3 py-2.5 shadow-lg pointer-events-auto flex items-start justify-between gap-2"
          >
            <div>
              <p className="font-semibold mb-0.5">{tr('toastEscalada')}</p>
              <p className="opacity-90">{toast.telefone} — {toast.intencao}</p>
              <p className="opacity-75 capitalize">{tr('urgencia')} {toast.urgencia}</p>
            </div>
            <button
              onClick={() => { removerToast(toast.id); onSelecionar(toast.conversaId) }}
              className="shrink-0 underline opacity-90 hover:opacity-100 text-xs"
            >
              {tr('ver')}
            </button>
          </div>
        ))}
      </div>

      <div className="p-4 border-b border-[#2a3942]">
        <h2 className="text-base font-semibold text-[#e9edef] mb-3">
          {tr('conversas')}
          <span className="ml-2 text-xs font-normal text-[#8696a0]">({todasFiltradas.length})</span>
        </h2>
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder={tr('buscarConversa')}
          className="w-full text-sm text-[#e9edef] bg-[#202c33] border border-[#2a3942] rounded-lg px-3 py-2 placeholder-[#3b4a54] focus:outline-none focus:ring-2 focus:ring-[#00a884]"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Conversas ativas */}
        <ul className="divide-y divide-[#2a3942]">
          {filtradas.length === 0 && expiradas.length === 0 && (
            <li className="p-4 text-sm text-[#3b4a54] text-center">{tr('nenhumaConversa')}</li>
          )}
          {filtradas.map(c => <ItemConversa key={c.id} c={c} selecionada={conversaSelecionada === c.id} onSelecionar={onSelecionar} tr={tr} />)}
        </ul>

        {/* Seção de janelas expiradas — só aparece se houver expiradas */}
        {expiradas.length > 0 && (
          <div className="border-t border-[#2a3942]">
            <button
              onClick={() => setExpiradaAberta(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[#8696a0] hover:bg-[#202c33] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3b4a54]" />
                Janela expirada
                <span className="bg-[#202c33] text-[#8696a0] rounded-full px-1.5 py-0.5 font-medium">
                  {expiradas.length}
                </span>
              </div>
              <svg
                className={`w-3.5 h-3.5 transition-transform ${expiradaAberta ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expiradaAberta && (
              <ul className="divide-y divide-[#2a3942] bg-[#111b21]">
                {expiradas.map(c => <ItemConversa key={c.id} c={c} selecionada={conversaSelecionada === c.id} onSelecionar={onSelecionar} tr={tr} expirada />)}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
