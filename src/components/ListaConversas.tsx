'use client'

import { useEffect, useState } from 'react'
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
  atualizado_em: string | null
  leads: { nome: string | null; telefone: string } | null
  operadores: { nome: string } | null
  mensagens: Mensagem[]
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

  async function carregar() {
    const res = await fetch('/api/conversas')
    const data = await res.json()
    setConversas(data)
  }

  useEffect(() => {
    carregar()

    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!)
    socket.on('nova-mensagem', () => carregar())

    return () => { socket?.disconnect() }
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
    <aside className="w-80 flex flex-col border-r border-gray-200 bg-white">
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

          return (
            <li
              key={c.id}
              onClick={() => onSelecionar(c.id)}
              className={`flex flex-col gap-1 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                conversaSelecionada === c.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{nome}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cor}`}>
                  {status.label}
                </span>
              </div>
              {ultimaMensagem && (
                <p className="text-xs text-gray-500 truncate">
                  <span className="font-medium">{ultimaMensagem.origem === 'lead' ? '👤' : ultimaMensagem.origem === 'ia' ? '🤖' : '🧑‍💼'}</span>{' '}
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
