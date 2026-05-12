'use client'

/**
 * Seção "Fluxos Automatizados" para a página /admin
 * Permite listar, criar, ativar/desativar, e excluir fluxos do cliente.
 * Também exibe execuções recentes (monitoramento).
 */

import React, { useEffect, useState, useCallback } from 'react'
import FluxoBuilder from './FluxoBuilder'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Fluxo {
  id: number
  nome: string
  descricao: string | null
  versao: number
  ativo: boolean
  is_padrao: boolean
  reengajamento_horas: number
  reengajamento_max_tentativas: number
  criado_em: string
  atualizado_em: string
}

interface ExecucaoFluxo {
  id: number
  status: string
  estagio_atual: string
  iniciada_em: string
  atualizada_em: string
  fluxos: { id: number; nome: string }
  conversas: {
    id: number
    leads: { nome: string | null; telefone: string } | null
  }
  _count: { eventos: number }
}

const STATUS_LABEL: Record<string, string> = {
  ativa: 'Ativa',
  aguardando_lead: 'Aguardando',
  reengajando: 'Reengajando',
  pausada_humano: 'Pausada (humano)',
  finalizada_sucesso: 'Sucesso',
  finalizada_perdida: 'Perdida',
  escalada: 'Escalada',
  erro: 'Erro',
}

const STATUS_COR: Record<string, string> = {
  ativa: 'bg-green-100 text-green-800',
  aguardando_lead: 'bg-yellow-100 text-yellow-800',
  reengajando: 'bg-orange-100 text-orange-800',
  pausada_humano: 'bg-blue-100 text-blue-800',
  finalizada_sucesso: 'bg-gray-100 text-gray-600',
  finalizada_perdida: 'bg-red-100 text-red-700',
  escalada: 'bg-purple-100 text-purple-800',
  erro: 'bg-red-200 text-red-900',
}


// ─── Componente principal ─────────────────────────────────────────────────────

export default function SecaoFluxos() {
  const [fluxos, setFluxos] = useState<Fluxo[]>([])
  const [execucoes, setExecucoes] = useState<ExecucaoFluxo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [subaba, setSubaba] = useState<'fluxos' | 'execucoes'>('fluxos')

  // Builder visual
  const [builderFluxo, setBuilderFluxo] = useState<Fluxo | null>(null)
  const [builderDefinicao, setBuilderDefinicao] = useState<Record<string, unknown> | null>(null)

  // Modal criar
  const [modalAberto, setModalAberto] = useState(false)
  const [formNome, setFormNome] = useState('')
  const [formDescricao, setFormDescricao] = useState('')
  const [formErro, setFormErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Filtro execuções
  const [filtroStatus, setFiltroStatus] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [rFluxos, rExecucoes] = await Promise.all([
        fetch('/api/fluxos'),
        fetch(`/api/execucoes-fluxo?limit=50${filtroStatus ? `&status=${filtroStatus}` : ''}`)
      ])
      if (rFluxos.ok) setFluxos(await rFluxos.json())
      if (rExecucoes.ok) setExecucoes(await rExecucoes.json())
    } finally {
      setCarregando(false)
    }
  }, [filtroStatus])

  useEffect(() => { carregar() }, [carregar])

  // ── Abrir builder visual ────────────────────────────────────────────────────
  async function abrirBuilder(fluxo: Fluxo) {
    const r = await fetch(`/api/fluxos/${fluxo.id}`)
    const data = await r.json()
    setBuilderDefinicao(data.definicao ?? null)
    setBuilderFluxo(fluxo)
  }

  // ── Criar fluxo e abrir builder ──────────────────────────────────────────────
  async function criarFluxo() {
    setFormErro('')
    if (!formNome.trim()) { setFormErro('Nome é obrigatório.'); return }
    setSalvando(true)
    try {
      // Cria com definição vazia — o builder vai preencher
      const definicaoVazia = { estagio_inicial: null, estagios: {}, agente: {} }
      const r = await fetch('/api/fluxos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: formNome, descricao: formDescricao || null, definicao: definicaoVazia })
      })
      if (!r.ok) {
        const e = await r.json()
        setFormErro(e.erro ?? 'Erro ao criar fluxo.')
        return
      }
      const novoFluxo = await r.json()
      setModalAberto(false)
      setFormNome('')
      setFormDescricao('')
      await carregar()
      // Abre o builder imediatamente após criar
      setBuilderDefinicao(novoFluxo.definicao ?? definicaoVazia)
      setBuilderFluxo(novoFluxo)
    } finally {
      setSalvando(false)
    }
  }

  // ── Ativar / desativar ────────────────────────────────────────────────────────
  async function toggleAtivo(fluxo: Fluxo) {
    const novoAtivo = !fluxo.ativo
    const body: Record<string, unknown> = { ativo: novoAtivo }
    if (novoAtivo) body.is_padrao = true // ao ativar, marca como padrão automaticamente
    await fetch(`/api/fluxos/${fluxo.id}/ativar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    carregar()
  }

  // ── Deletar ──────────────────────────────────────────────────────────────────
  async function deletar(fluxo: Fluxo) {
    if (!confirm(`Excluir fluxo "${fluxo.nome}"? Esta ação não pode ser desfeita.`)) return
    const r = await fetch(`/api/fluxos/${fluxo.id}`, { method: 'DELETE' })
    if (!r.ok) {
      const e = await r.json()
      alert(e.erro ?? 'Erro ao excluir.')
      return
    }
    carregar()
  }

  // ── Ação manual em execução ───────────────────────────────────────────────────
  async function acaoExecucao(execucao: ExecucaoFluxo, acao: 'pausar' | 'retomar' | 'finalizar') {
    await fetch(`/api/execucoes-fluxo/${execucao.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao })
    })
    carregar()
  }

  // Builder aberto em tela cheia
  if (builderFluxo) {
    return (
      <FluxoBuilder
        fluxoId={builderFluxo.id}
        nomeInicial={builderFluxo.nome}
        definicaoInicial={builderDefinicao}
        onClose={() => setBuilderFluxo(null)}
        onSaved={() => { setBuilderFluxo(null); carregar() }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Sub-abas */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'fluxos', label: '🤖 Definições' },
          { key: 'execucoes', label: '📡 Execuções' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSubaba(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subaba === key
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Sub-aba: Fluxos ───────────────────────────────────────────────────── */}
      {subaba === 'fluxos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Fluxos Automatizados</h2>
              <p className="text-sm text-gray-500">Configure automações de conversa com IA. Apenas 1 fluxo pode estar ativo por vez.</p>
            </div>
            <button
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Fluxo
            </button>
          </div>

          {carregando ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : fluxos.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-sm font-medium">Nenhum fluxo criado</p>
              <p className="text-xs mt-1">Crie seu primeiro fluxo automatizado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fluxos.map(fluxo => (
                <div
                  key={fluxo.id}
                  className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-sm ${
                    fluxo.ativo ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{fluxo.nome}</span>
                        {fluxo.is_padrao && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                            Padrão
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          fluxo.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {fluxo.ativo ? '● Ativo' : '○ Inativo'}
                        </span>
                        <span className="text-xs text-gray-400">v{fluxo.versao}</span>
                      </div>
                      {fluxo.descricao && (
                        <p className="text-xs text-gray-500 mt-1">{fluxo.descricao}</p>
                      )}
                      <div className="flex gap-3 mt-2 text-xs text-gray-400">
                        <span>⏰ Reengaja em {fluxo.reengajamento_horas}h</span>
                        <span>🔄 Máx {fluxo.reengajamento_max_tentativas} tentativas</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Builder visual */}
                      <button
                        onClick={() => abrirBuilder(fluxo)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors"
                      >
                        🛠 Construir
                      </button>

                      {/* Toggle ativo */}
                      <button
                        onClick={() => toggleAtivo(fluxo)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                          fluxo.ativo
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {fluxo.ativo ? 'Desativar' : 'Ativar'}
                      </button>

                      {/* Deletar */}
                      <button
                        onClick={() => deletar(fluxo)}
                        disabled={fluxo.ativo}
                        title={fluxo.ativo ? 'Desative antes de excluir' : 'Excluir fluxo'}
                        className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Sub-aba: Execuções ────────────────────────────────────────────────── */}
      {subaba === 'execucoes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Execuções de Fluxo</h2>
              <p className="text-sm text-gray-500">Acompanhe o progresso das conversas em automação.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-green-300 focus:outline-none"
              >
                <option value="">Todos os status</option>
                <option value="ativa">Ativa</option>
                <option value="aguardando_lead">Aguardando lead</option>
                <option value="reengajando">Reengajando</option>
                <option value="pausada_humano">Pausada</option>
                <option value="finalizada_sucesso">Sucesso</option>
                <option value="finalizada_perdida">Perdida</option>
                <option value="escalada">Escalada</option>
              </select>
              <button
                onClick={carregar}
                className="p-1.5 text-gray-500 hover:text-green-600 transition-colors"
                title="Atualizar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {carregando ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : execucoes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">Nenhuma execução encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Lead</th>
                    <th className="px-4 py-3 text-left font-medium">Fluxo</th>
                    <th className="px-4 py-3 text-left font-medium">Estágio</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Eventos</th>
                    <th className="px-4 py-3 text-left font-medium">Atualizado</th>
                    <th className="px-4 py-3 text-left font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {execucoes.map(ex => (
                    <tr key={ex.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-xs">
                          {ex.conversas?.leads?.nome || ex.conversas?.leads?.telefone || '—'}
                        </div>
                        <div className="text-gray-400 text-xs">{ex.conversas?.leads?.telefone}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{ex.fluxos?.nome}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                          {ex.estagio_atual}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COR[ex.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABEL[ex.status] ?? ex.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{ex._count.eventos}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(ex.atualizada_em).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {['ativa', 'aguardando_lead', 'reengajando'].includes(ex.status) && (
                            <>
                              <button
                                onClick={() => acaoExecucao(ex, 'pausar')}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Pausar
                              </button>
                              <span className="text-gray-300">·</span>
                              <button
                                onClick={() => acaoExecucao(ex, 'finalizar')}
                                className="text-xs text-red-500 hover:underline"
                              >
                                Finalizar
                              </button>
                            </>
                          )}
                          {ex.status === 'pausada_humano' && (
                            <button
                              onClick={() => acaoExecucao(ex, 'retomar')}
                              className="text-xs text-green-600 hover:underline"
                            >
                              Retomar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Criar Fluxo ────────────────────────────────────────────────── */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Novo Fluxo Automatizado</h3>
              <button
                onClick={() => { setModalAberto(false); setFormErro('') }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formNome}
                  onChange={e => setFormNome(e.target.value)}
                  placeholder="Ex: Qualificação de Leads"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-300 focus:border-green-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  value={formDescricao}
                  onChange={e => setFormDescricao(e.target.value)}
                  placeholder="Descrição opcional do fluxo"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-300 focus:border-green-400 focus:outline-none"
                />
              </div>

              {formErro && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formErro}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => { setModalAberto(false); setFormErro('') }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={criarFluxo}
                disabled={salvando}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {salvando && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Criar Fluxo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
