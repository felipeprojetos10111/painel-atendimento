'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Lead { id: number; nome: string | null; telefone: string }
interface Operador { id: number; nome: string }
interface UltimaMensagem { conteudo: string; origem: string; enviado_em: string; tipo: string }

interface Conversa {
  id: number
  status: string | null
  criado_em: string
  atualizado_em: string | null
  ultima_mensagem_em: string | null
  janela_expirada: boolean
  leads: Lead | null
  operadores: Operador | null
  mensagens: UltimaMensagem[]
}

interface Mensagem {
  id: number
  origem: string
  conteudo: string
  tipo: string | null
  url_midia: string | null
  enviado_em: string
  origem_fluxo: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; cor: string }> = {
  aguardando:        { label: 'Aguardando',        cor: 'bg-yellow-100 text-yellow-800' },
  aguardando_humano: { label: 'Aguard. humano',    cor: 'bg-orange-100 text-orange-800' },
  em_atendimento:    { label: 'Em atendimento',    cor: 'bg-blue-100 text-blue-800' },
  resolvida:         { label: 'Resolvida',         cor: 'bg-gray-100 text-gray-500' },
}

function badgeStatus(status: string | null) {
  const s = STATUS_LABELS[status ?? ''] ?? { label: status ?? '—', cor: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cor}`}>
      {s.label}
    </span>
  )
}

function formatarData(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function previewMensagem(m: UltimaMensagem) {
  if (m.tipo && m.tipo !== 'texto') return `[${m.tipo}]`
  return m.conteudo.length > 60 ? m.conteudo.slice(0, 60) + '…' : m.conteudo
}

// ─── Painel de mensagens ──────────────────────────────────────────────────────

function PainelMensagens({ conversa, onFechar, onReatribuido }: { conversa: Conversa; onFechar: () => void; onReatribuido: () => void }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [reatribuindo, setReatribuindo] = useState(false)
  const [operadorSelecionado, setOperadorSelecionado] = useState<string>('')
  const [salvandoReatrib, setSalvandoReatrib] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCarregando(true)
    fetch(`/api/conversas/${conversa.id}/mensagens`)
      .then(r => r.json())
      .then(data => { setMensagens(data); setCarregando(false) })
      .catch(() => setCarregando(false))
    fetch('/api/operadores')
      .then(r => r.json())
      .then(setOperadores)
      .catch(() => {})
  }, [conversa.id])

  async function reatribuir() {
    setSalvandoReatrib(true)
    try {
      await fetch(`/api/conversas/${conversa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operador_id: operadorSelecionado === 'fila' ? null : Number(operadorSelecionado),
          status: operadorSelecionado === 'fila' ? 'aguardando_humano' : 'em_atendimento',
        }),
      })
      setReatribuindo(false)
      onReatribuido()
    } finally {
      setSalvandoReatrib(false)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const origemLabel: Record<string, string> = { lead: 'Lead', ia: 'IA / Fluxo', operador: 'Operador' }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/40" onClick={onFechar} />

      {/* Painel */}
      <div className="w-full max-w-lg bg-white flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">
                {conversa.leads?.nome ?? conversa.leads?.telefone ?? 'Lead desconhecido'}
              </span>
              <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                #{conversa.id}
              </span>
              {badgeStatus(conversa.status)}
              {conversa.janela_expirada && (
                <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  ⏰ Expirada
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{conversa.leads?.telefone}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span>👤 {conversa.operadores?.nome ?? <em className="text-gray-400">Sem operador</em>}</span>
              <span>📅 {formatarData(conversa.criado_em)}</span>
              <button
                onClick={() => { setReatribuindo(v => !v); setOperadorSelecionado('') }}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Reatribuir
              </button>
            </div>

            {reatribuindo && (
              <div className="flex items-center gap-2 mt-2">
                <select
                  value={operadorSelecionado}
                  onChange={e => setOperadorSelecionado(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900 bg-white focus:ring-2 focus:ring-blue-300 focus:outline-none"
                >
                  <option value="">Selecionar...</option>
                  <option value="fila">↩ Devolver à fila</option>
                  {operadores.map(op => (
                    <option key={op.id} value={String(op.id)}>{op.nome}</option>
                  ))}
                </select>
                <button
                  onClick={reatribuir}
                  disabled={!operadorSelecionado || salvandoReatrib}
                  className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  {salvandoReatrib ? 'Salvando…' : 'Confirmar'}
                </button>
                <button onClick={() => setReatribuindo(false)} className="text-xs text-gray-400 hover:text-gray-600">
                  Cancelar
                </button>
              </div>
            )}
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
          {carregando ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : mensagens.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">Nenhuma mensagem</p>
          ) : (
            mensagens.map(msg => {
              const isLead = msg.origem === 'lead'
              const isOp   = msg.origem === 'operador'
              return (
                <div key={msg.id} className={`flex ${isLead ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm ${
                    isLead  ? 'bg-white text-gray-900 rounded-tl-sm' :
                    isOp    ? 'bg-blue-600 text-white rounded-tr-sm' :
                              'bg-green-600 text-white rounded-tr-sm'
                  }`}>
                    {/* Origem badge */}
                    <p className={`text-[10px] font-medium mb-0.5 ${
                      isLead ? 'text-gray-400' : 'text-white/70'
                    }`}>
                      {origemLabel[msg.origem] ?? msg.origem}
                      {msg.origem_fluxo ? ` · ${msg.origem_fluxo}` : ''}
                    </p>
                    {msg.tipo && msg.tipo !== 'texto' ? (
                      <p className="text-sm italic">[{msg.tipo}]</p>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
                    )}
                    <p className={`text-[10px] mt-1 text-right ${isLead ? 'text-gray-400' : 'text-white/60'}`}>
                      {formatarData(msg.enviado_em)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SecaoHistorico() {
  const [conversas, setConversas]     = useState<Conversa[]>([])
  const [total, setTotal]             = useState(0)
  const [pagina, setPagina]           = useState(0)
  const [carregando, setCarregando]   = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)

  // Filtros
  const [filtroStatus,    setFiltroStatus]    = useState('')
  const [filtroOperador,  setFiltroOperador]  = useState('')
  const [busca,           setBusca]           = useState('')
  const [buscaInput,      setBuscaInput]      = useState('')

  // Operadores disponíveis para o filtro
  const [operadores, setOperadores] = useState<Operador[]>([])

  // Painel de detalhes
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null)

  // ── Carregar operadores ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/operadores').then(r => r.json()).then(setOperadores).catch(() => {})
  }, [])

  // ── Carregar conversas ──────────────────────────────────────────────────────
  const buildUrl = useCallback((pg: number) => {
    const p = new URLSearchParams({ pagina: String(pg), limite: '30' })
    if (filtroStatus)   p.set('status', filtroStatus)
    if (filtroOperador) p.set('operador_id', filtroOperador)
    if (busca)          p.set('busca', busca)
    return `/api/admin/historico-conversas?${p}`
  }, [filtroStatus, filtroOperador, busca])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setPagina(0)
    try {
      const r = await fetch(buildUrl(0))
      if (r.ok) {
        const data = await r.json()
        setConversas(data.conversas)
        setTotal(data.total)
      }
    } finally {
      setCarregando(false)
    }
  }, [buildUrl])

  useEffect(() => { carregar() }, [carregar])

  async function carregarMais() {
    const proxima = pagina + 1
    setCarregandoMais(true)
    try {
      const r = await fetch(buildUrl(proxima))
      if (r.ok) {
        const data = await r.json()
        setConversas(prev => [...prev, ...data.conversas])
        setPagina(proxima)
      }
    } finally {
      setCarregandoMais(false)
    }
  }

  function aplicarBusca() {
    setBusca(buscaInput.trim())
  }

  const temMais = conversas.length < total

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Histórico de Conversas</h2>
        <p className="text-sm text-gray-500">
          Todas as conversas do cliente, incluindo encerradas e expiradas. Total: <strong>{total}</strong>
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Busca */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={buscaInput}
            onChange={e => setBuscaInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && aplicarBusca()}
            placeholder="Nome ou telefone..."
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-300 focus:outline-none w-52"
          />
          <button
            onClick={aplicarBusca}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
          >
            Buscar
          </button>
          {busca && (
            <button
              onClick={() => { setBusca(''); setBuscaInput('') }}
              className="px-3 py-1.5 border border-gray-200 text-gray-500 hover:text-gray-700 text-sm rounded-lg transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status */}
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-300 focus:outline-none"
        >
          <option value="">Todos os status</option>
          <option value="aguardando">Aguardando</option>
          <option value="aguardando_humano">Aguard. humano</option>
          <option value="em_atendimento">Em atendimento</option>
          <option value="resolvida">Resolvida</option>
        </select>

        {/* Operador */}
        <select
          value={filtroOperador}
          onChange={e => setFiltroOperador(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-300 focus:outline-none"
        >
          <option value="">Todos os operadores</option>
          <option value="sem">Sem operador</option>
          {operadores.map(op => (
            <option key={op.id} value={String(op.id)}>{op.nome}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : conversas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-sm">Nenhuma conversa encontrada</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Lead</th>
                <th className="px-4 py-3 text-left font-medium">Última mensagem</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Operador</th>
                <th className="px-4 py-3 text-left font-medium">Atualizado</th>
                <th className="px-4 py-3 text-left font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conversas.map(c => (
                <tr
                  key={c.id}
                  onClick={() => setConversaSelecionada(c)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {/* Lead */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-gray-900">
                        {c.leads?.nome ?? <span className="text-gray-400 italic">Sem nome</span>}
                      </p>
                      <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1 py-0.5 rounded shrink-0">
                        #{c.id}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{c.leads?.telefone}</p>
                  </td>

                  {/* Última mensagem */}
                  <td className="px-4 py-3 max-w-[220px]">
                    {c.mensagens[0] ? (
                      <>
                        <p className="text-gray-700 truncate">{previewMensagem(c.mensagens[0])}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.mensagens[0].origem === 'lead' ? '👤' : c.mensagens[0].origem === 'operador' ? '🧑‍💼' : '🤖'}{' '}
                          {formatarData(c.mensagens[0].enviado_em)}
                        </p>
                      </>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Sem mensagens</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">{badgeStatus(c.status)}</td>

                  {/* Operador */}
                  <td className="px-4 py-3">
                    {c.operadores ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                        🧑‍💼 {c.operadores.nome}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Sem operador</span>
                    )}
                  </td>

                  {/* Atualizado */}
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatarData(c.atualizado_em)}
                  </td>

                  {/* Flags */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {c.janela_expirada && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full w-fit">
                          ⏰ Expirada
                        </span>
                      )}
                      {!c.janela_expirada && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full w-fit">
                          ✅ Ativa
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Carregar mais */}
      {temMais && !carregando && (
        <div className="flex justify-center pt-2">
          <button
            onClick={carregarMais}
            disabled={carregandoMais}
            className="flex items-center gap-2 px-5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {carregandoMais && <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
            Carregar mais ({total - conversas.length} restantes)
          </button>
        </div>
      )}

      {/* Painel lateral de mensagens */}
      {conversaSelecionada && (
        <PainelMensagens
          conversa={conversaSelecionada}
          onFechar={() => setConversaSelecionada(null)}
          onReatribuido={() => { setConversaSelecionada(null); carregar() }}
        />
      )}
    </div>
  )
}
