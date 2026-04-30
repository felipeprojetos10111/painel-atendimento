'use client'

import { useEffect, useState, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useLingua } from '@/contexts/LinguaContext'
import SeletorLingua from '@/components/SeletorLingua'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Operador {
  id: number
  nome: string
  email: string
  nivel: string | null
  ativo: boolean | null
  criado_em: string | null
  conversasAtivas: number
}

const FORM_OPERADOR_VAZIO = { nome: '', email: '', senha: '', nivel: 'operador' }

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const { tr } = useLingua()
  const [aba, setAba] = useState<'operadores' | 'ia' | 'configuracoes' | 'leads' | 'metricas'>('operadores')
  const [impersonando, setImpersonando] = useState(false)
  const [nomeClienteImp, setNomeClienteImp] = useState('')
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.impersonando) {
          setImpersonando(true)
          setNomeClienteImp(data.nomeCliente ?? '')
        }
      })
  }, [])

  async function sairImpersonacao() {
    setSaindo(true)
    await fetch('/api/super-admin/sair-impersonar', { method: 'POST' })
    router.push('/super-admin')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-green-600 text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/painel')}
            className="hover:bg-green-700 p-1.5 rounded-lg transition-colors"
            title={tr('voltarAoPainel')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <span className="font-semibold text-lg">{tr('administracao')}</span>
        </div>
        <div className="flex items-center gap-2">
          <SeletorLingua variante="topbar" />
          <span className="text-xs bg-green-700 px-2.5 py-1 rounded-full font-medium">{tr('supervisorLabel')}</span>
        </div>
      </header>

      {/* Banner de impersonação */}
      {impersonando && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>
              Você está visualizando o painel como <strong>Admin de {nomeClienteImp || 'cliente'}</strong> — modo impersonação ativo.
            </span>
          </div>
          <button
            onClick={sairImpersonacao}
            disabled={saindo}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-amber-700 border border-amber-300 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {saindo
              ? <span className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
            }
            Voltar ao Super Admin
          </button>
        </div>
      )}

      {/* Abas */}
      <div className="border-b border-gray-200 bg-white px-6">
        <nav className="flex gap-1 -mb-px">
          {([
            { key: 'operadores',    label: 'Operadores' },
            { key: 'ia',           label: 'IA' },
            { key: 'configuracoes', label: 'Configurações' },
            { key: 'leads',        label: '📋 Leads' },
            { key: 'metricas',     label: '📊 Métricas' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                aba === key
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {aba === 'operadores'    && <SecaoOperadores />}
        {aba === 'ia'            && <SecaoIA />}
        {aba === 'configuracoes' && <SecaoConfiguracoes />}
        {aba === 'leads'         && <SecaoLeads />}
        {aba === 'metricas'      && <SecaoMetricas />}
      </div>
    </div>
  )
}

// ─── Seção: Operadores ────────────────────────────────────────────────────────

function SecaoOperadores() {
  const { tr } = useLingua()
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [idsOnline, setIdsOnline] = useState<Set<number>>(new Set())
  const [form, setForm] = useState(FORM_OPERADOR_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [atualizando, setAtualizando] = useState<number | null>(null)
  const [deletando, setDeletando] = useState<number | null>(null)

  async function carregar() {
    const res = await fetch('/api/operadores')
    setOperadores(await res.json())
  }

  async function carregarOnline() {
    const res = await fetch('/api/operadores/online')
    if (res.ok) {
      const data = await res.json()
      setIdsOnline(new Set(data.online))
    }
  }

  useEffect(() => {
    carregar()
    carregarOnline()
    // Atualiza presença a cada 10s e contagem de conversas a cada 15s
    const timerOnline = setInterval(carregarOnline, 10000)
    const timerOperadores = setInterval(carregar, 15000)
    return () => { clearInterval(timerOnline); clearInterval(timerOperadores) }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSucesso(''); setSalvando(true)

    try {
      const res = await fetch('/api/operadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (!res.ok) throw new Error((await res.json()).erro ?? tr('erroDesconhecido'))

      setSucesso(`${tr('nivelOperador')} ${form.nome} ${tr('operadorCadastrado')}`)
      setForm(FORM_OPERADOR_VAZIO)
      await carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr('erroDesconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  async function toggleAtivo(op: Operador) {
    setAtualizando(op.id)
    await fetch(`/api/operadores/${op.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !op.ativo })
    })
    setAtualizando(null)
    await carregar()
  }

  async function handleDeletar(op: Operador) {
    if (!confirm(`${tr('confirmarDeletarOp1')} ${op.nome}? ${tr('confirmarDeletarOp2')}`)) return
    setDeletando(op.id)
    await fetch(`/api/operadores/${op.id}`, { method: 'DELETE' })
    setDeletando(null)
    await carregar()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Formulário */}
      <section className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 text-base mb-5">{tr('novoOperador')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">

            <Field label={tr('nomeField')} required>
              <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                required placeholder="Ex: João Silva" className={inputCls} />
            </Field>

            <Field label={tr('email')} required>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required placeholder="joao@empresa.com" className={inputCls} />
            </Field>

            <Field label={tr('senha')} required>
              <input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                required minLength={6} placeholder={tr('minimoSenha')} className={inputCls} />
            </Field>

            <Field label={tr('nivelField')}>
              <select value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: e.target.value }))} className={inputCls}>
                <option value="operador">{tr('nivelOperador')}</option>
                <option value="supervisor">{tr('nivelSupervisor')}</option>
              </select>
            </Field>

            <Feedback erro={erro} sucesso={sucesso} />

            <button type="submit" disabled={salvando} className={btnPrimario}>
              {salvando ? tr('cadastrando') : tr('cadastrarOperador')}
            </button>
          </form>
        </div>
      </section>

      {/* Lista */}
      <section className="lg:col-span-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-base">
              {tr('operadoresCadastrados')} <span className="text-sm font-normal text-gray-400">({operadores.length})</span>
            </h2>
            {idsOnline.size > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {idsOnline.size} {tr('operadoresOnline')}
              </span>
            )}
          </div>

          {operadores.length === 0 ? (
            <EmptyState icone="👥" texto={tr('nenhumOperador')} />
          ) : (
            <ul className="divide-y divide-gray-50">
              {operadores.map(op => {
                const online = idsOnline.has(op.id)
                return (
                <li key={op.id} className={`flex items-center gap-4 px-6 py-4 ${!op.ativo ? 'opacity-60' : ''}`}>
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-semibold text-sm">
                      {op.nome.charAt(0).toUpperCase()}
                    </div>
                    <span
                      title={online ? 'Online' : 'Offline'}
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        online ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{op.nome}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        op.nivel === 'supervisor'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {op.nivel === 'supervisor' ? tr('nivelSupervisor') : tr('nivelOperador')}
                      </span>
                      {online && op.ativo && (
                        <span className="text-xs text-green-600 font-medium">● online</span>
                      )}
                      {!op.ativo && <span className="text-xs text-red-400 italic">{tr('inativo')}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{op.email}</span>
                      {op.conversasAtivas > 0 && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-medium">
                          {op.conversasAtivas} {op.conversasAtivas === 1 ? 'conversa' : 'conversas'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleAtivo(op)}
                      disabled={atualizando === op.id}
                      title={op.ativo ? 'Desativar' : 'Ativar'}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40 ${
                        op.ativo ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                        op.ativo ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>

                    <BotaoDeletar onClick={() => handleDeletar(op)} carregando={deletando === op.id} />
                  </div>
                </li>
              )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

// ─── Seção: Gestão de IA ─────────────────────────────────────────────────────

interface ConfigIA {
  ativo: boolean
  prompt_sistema: string
  atualizado_em: string | null
  atualizado_por: string | null
}

interface TesteResultado {
  acao: string        // responder_lead | solicitar_informacao | escalar_humano
  mensagem?: string   // responder_lead
  pergunta?: string   // solicitar_informacao
  motivo?: string     // escalar_humano
  urgencia?: string   // escalar_humano
}

const PROMPT_PADRAO = 'Você é um assistente de atendimento ao cliente prestativo e profissional. Seu papel é triagem de leads via WhatsApp: responda dúvidas simples, colete informações quando necessário, e escale para um operador humano quando não conseguir resolver ou quando o lead pedir.'

function SecaoIA() {
  const { tr } = useLingua()
  const [ativo, setAtivo] = useState(true)
  const [prompt, setPrompt] = useState(PROMPT_PADRAO)
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null)
  const [atualizadoPor, setAtualizadoPor] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [testeMensagem, setTesteMensagem] = useState('')
  const [testeResultado, setTesteResultado] = useState<TesteResultado | null>(null)
  const [testeErro, setTesteErro] = useState('')
  const [testeRaw, setTesteRaw] = useState('')
  const [testando, setTestando] = useState(false)
  const [testeFoiRealizado, setTesteFoiRealizado] = useState(false)

  useEffect(() => {
    fetch('/api/ia/config')
      .then(r => r.ok ? r.json() : null)
      .then((data: ConfigIA | null) => {
        if (!data) return
        setAtivo(data.ativo)
        setPrompt(data.prompt_sistema)
        setAtualizadoEm(data.atualizado_em)
        setAtualizadoPor(data.atualizado_por)
      })
  }, [])

  async function salvar() {
    setErro(''); setSucesso(''); setSalvando(true)
    try {
      const res = await fetch('/api/ia/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo, prompt_sistema: prompt })
      })
      if (!res.ok) throw new Error((await res.json()).error ?? tr('erroDesconhecido'))
      const data: ConfigIA = await res.json()
      setAtualizadoEm(data.atualizado_em)
      setAtualizadoPor(data.atualizado_por)
      setSucesso(tr('iaSucessoConfig'))
      setTesteFoiRealizado(false)
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr('erroDesconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  async function testar() {
    if (!testeMensagem.trim()) return
    setTesteErro(''); setTesteResultado(null); setTesteRaw(''); setTestando(true)
    try {
      const res = await fetch('/api/ia/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: testeMensagem, prompt_sistema: prompt })
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.raw) setTesteRaw(data.raw)
        throw new Error(data.error ?? tr('erroDesconhecido'))
      }
      setTesteResultado(data.decisao)
      setTesteFoiRealizado(true)
    } catch (err) {
      setTesteErro(err instanceof Error ? err.message : tr('erroDesconhecido'))
    } finally {
      setTestando(false)
    }
  }

  const charCount = prompt.length
  const charMax = 20000

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Cabeçalho: toggle ativo + última atualização */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAtivo(v => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${ativo ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${ativo ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm font-semibold ${ativo ? 'text-green-700' : 'text-gray-400'}`}>
            {ativo ? tr('iaAtiva') : tr('iaInativa')}
          </span>
          {!ativo && (
            <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
              Mensagens vão direto para fila humana
            </span>
          )}
        </div>
        {atualizadoEm && (
          <span className="text-xs text-gray-400 hidden sm:block">
            {tr('iaUltimaAtualizacao')}: {new Date(atualizadoEm).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })} {tr('iaPor')} {atualizadoPor}
          </span>
        )}
      </div>

      {/* Prompt do sistema */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <label className="block text-sm font-semibold text-gray-800">{tr('iaPromptSistema')}</label>
            <p className="text-xs text-gray-400 mt-0.5">{tr('iaPromptDica')}</p>
          </div>
          <span className={`text-xs font-mono shrink-0 ml-2 ${charCount > charMax * 0.9 ? 'text-red-500' : 'text-gray-400'}`}>
            {charCount} / {charMax}
          </span>
        </div>
        <textarea
          value={prompt}
          onChange={e => { setPrompt(e.target.value); setTesteFoiRealizado(false) }}
          maxLength={charMax}
          rows={14}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-y font-mono leading-relaxed"
          placeholder="Você é um assistente..."
        />
      </div>

      {/* Teste interno */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">{tr('iaTesteAoVivo')}</h3>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-4">
          {tr('iaTesteAviso')}
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={testeMensagem}
            onChange={e => setTesteMensagem(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') testar() }}
            placeholder={tr('iaMensagemTeste')}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={testar}
            disabled={testando || !testeMensagem.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            {testando
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              : tr('iaTestar')
            }
          </button>
        </div>

        {testeErro && (
          <div className="mb-3">
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{testeErro}</p>
          </div>
        )}

        {testeResultado && (() => {
          const isResponder = testeResultado.acao === 'responder_lead'
          const isSolicitar = testeResultado.acao === 'solicitar_informacao'
          const isEscalar   = testeResultado.acao === 'escalar_humano'
          const texto = testeResultado.mensagem ?? testeResultado.pergunta ?? testeResultado.motivo ?? ''
          const borderCls = isResponder ? 'border-green-200 bg-green-50'
            : isSolicitar ? 'border-blue-200 bg-blue-50'
            : 'border-orange-200 bg-orange-50'
          const badgeCls = isResponder ? 'bg-green-500 text-white'
            : isSolicitar ? 'bg-blue-500 text-white'
            : 'bg-orange-500 text-white'
          const badgeLabel = isResponder ? '✓ Respondeu ao lead'
            : isSolicitar ? '? Pediu informação'
            : '⚡ Escalou para humano'
          const textoLabel = isResponder ? 'Mensagem ao lead'
            : isSolicitar ? 'Pergunta ao lead'
            : 'Motivo da escalação'
          return (
            <div className={`rounded-xl border-2 p-4 ${borderCls}`}>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${badgeCls}`}>
                  {badgeLabel}
                </span>
                {testeResultado.urgencia && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    testeResultado.urgencia === 'alta' ? 'bg-red-100 text-red-700' :
                    testeResultado.urgencia === 'media' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    Urgência: {testeResultado.urgencia}
                  </span>
                )}
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{textoLabel}</span>
                <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{texto}</p>
              </div>
            </div>
          )
        })()}

        {!testeResultado && !testeErro && !testando && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
            Digite uma mensagem de teste e clique em Testar para ver como a IA responderia
          </div>
        )}
      </div>

      {/* Botão salvar — destaque quando teste foi realizado */}
      <div className="flex items-center justify-between gap-4">
        <Feedback erro={erro} sucesso={sucesso} />
        <button
          onClick={salvar}
          disabled={salvando}
          className={`shrink-0 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 ${
            testeFoiRealizado
              ? 'bg-green-500 hover:bg-green-600 ring-2 ring-green-300 ring-offset-2'
              : 'bg-gray-400 hover:bg-gray-500'
          }`}
        >
          {salvando ? tr('iaSalvandoConfig') : tr('iaSalvarConfig')}
        </button>
      </div>
    </div>
  )
}

// ─── Seção: Configurações do cliente ─────────────────────────────────────────

interface ClienteConfig {
  id: number
  nome: string
  slug: string
  phone_number_id: string
  verify_token: string
  whatsapp_token: string
  app_secret: string
  ia_api_key: string
  webhook_secret: string
  plataforma_base_url: string
}

function SecaoConfiguracoes() {
  const { tr } = useLingua()
  const [config, setConfig] = useState<ClienteConfig | null>(null)
  const [form, setForm] = useState({
    whatsapp_token:      '',
    phone_number_id:     '',
    app_secret:          '',
    verify_token:        '',
    ia_api_key:          '',
    plataforma_base_url: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [sucesso, setSucesso]   = useState('')
  const [copiado, setCopiado]   = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [plataformaWebhookUrl, setPlataformaWebhookUrl] = useState('')
  const [copiadoSecret, setCopiadoSecret] = useState(false)
  const [copiadoPlataforma, setCopiadoPlataforma] = useState(false)
  const [mostrarSecret, setMostrarSecret] = useState(false)

  useEffect(() => {
    setWebhookUrl(window.location.origin + '/webhook')
    fetch('/api/cliente/config')
      .then(r => r.ok ? r.json() : null)
      .then((data: ClienteConfig | null) => {
        if (!data) return
        setConfig(data)
        setPlataformaWebhookUrl(window.location.origin + '/api/webhooks/plataforma/' + data.slug)
        setForm({
          whatsapp_token:      data.whatsapp_token,
          phone_number_id:     data.phone_number_id,
          app_secret:          data.app_secret,
          verify_token:        data.verify_token,
          ia_api_key:          data.ia_api_key,
          plataforma_base_url: data.plataforma_base_url,
        })
      })
  }, [])

  function setField(campo: keyof typeof form, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
    setSucesso('')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSucesso(''); setSalvando(true)
    try {
      const res = await fetch('/api/cliente/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (!res.ok) throw new Error((await res.json()).erro ?? tr('erroDesconhecido'))
      const data: ClienteConfig = await res.json()
      setConfig(data)
      setForm({
        whatsapp_token:      data.whatsapp_token,
        phone_number_id:     data.phone_number_id,
        app_secret:          data.app_secret,
        verify_token:        data.verify_token,
        ia_api_key:          data.ia_api_key,
        plataforma_base_url: data.plataforma_base_url,
      })
      setSucesso(tr('cfgSucesso'))
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr('erroDesconhecido'))
    } finally {
      setSalvando(false)
    }
  }

  async function copiarWebhook() {
    await navigator.clipboard.writeText(webhookUrl)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function copiarSecret() {
    if (config?.webhook_secret) {
      await navigator.clipboard.writeText(config.webhook_secret)
      setCopiadoSecret(true)
      setTimeout(() => setCopiadoSecret(false), 2000)
    }
  }

  async function copiarPlataformaWebhook() {
    await navigator.clipboard.writeText(plataformaWebhookUrl)
    setCopiadoPlataforma(true)
    setTimeout(() => setCopiadoPlataforma(false), 2000)
  }

  const MASCARA = '••••••••'
  const isMascarado = (v: string) => v === MASCARA

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {config && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-lg">
            {config.nome.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{config.nome}</p>
            <p className="text-xs text-gray-400 font-mono">@{config.slug} · ID {config.id}</p>
          </div>
        </div>
      )}

      <form onSubmit={salvar} className="space-y-6">

        {/* Seção WhatsApp */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💬</span>
            <h2 className="text-sm font-semibold text-gray-800">{tr('cfgTituloWhatsApp')}</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">{tr('cfgDescWhatsApp')}</p>

          <div className="space-y-4">
            <CampoSensivel
              label={tr('cfgWhatsappToken')}
              valor={form.whatsapp_token}
              onChange={v => setField('whatsapp_token', v)}
              placeholder="EAABsbCS..."
              mascarado={isMascarado(form.whatsapp_token)}
              dica={tr('cfgCampoSensivel')}
            />

            <Field label={tr('cfgPhoneNumberId')}>
              <input
                type="text"
                value={form.phone_number_id}
                onChange={e => setField('phone_number_id', e.target.value)}
                placeholder="123456789012345"
                className={inputCls}
              />
            </Field>

            <CampoSensivel
              label={tr('cfgAppSecret')}
              valor={form.app_secret}
              onChange={v => setField('app_secret', v)}
              placeholder="abc123..."
              mascarado={isMascarado(form.app_secret)}
              dica={tr('cfgCampoSensivel')}
            />

            <Field label={tr('cfgVerifyToken')}>
              <input
                type="text"
                value={form.verify_token}
                onChange={e => setField('verify_token', e.target.value)}
                placeholder="meu_verify_token_2024"
                className={inputCls}
              />
            </Field>

            {/* Webhook URL — somente leitura */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr('cfgWebhookUrl')}
              </label>
              <p className="text-xs text-gray-400 mb-2">{tr('cfgWebhookUrlDica')}</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={webhookUrl}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50 font-mono focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={copiarWebhook}
                  className="shrink-0 text-sm font-medium text-white bg-gray-500 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors"
                >
                  {copiado ? tr('cfgCopiado') : tr('cfgCopiar')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Seção IA */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🤖</span>
            <h2 className="text-sm font-semibold text-gray-800">{tr('cfgTituloIA')}</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">{tr('cfgDescIA')}</p>

          <CampoSensivel
            label={tr('cfgIaApiKey')}
            valor={form.ia_api_key}
            onChange={v => setField('ia_api_key', v)}
            placeholder={tr('cfgIaApiKeyPlaceholder')}
            mascarado={isMascarado(form.ia_api_key)}
            dica={tr('cfgCampoSensivel')}
          />
        </div>

        {/* Seção Integração com Plataforma */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🔗</span>
            <h2 className="text-sm font-semibold text-gray-800">Integração com Plataforma</h2>
          </div>
          <p className="text-xs text-gray-400 mb-5">
            Configure esses dados no webhook da sua plataforma para rastrear registros e depósitos dos leads.
          </p>

          <div className="space-y-4">
            {/* URL base da plataforma */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL base de registro
              </label>
              <p className="text-xs text-gray-400 mb-2">
                URL da página de cadastro da plataforma. O código único de cada operador será anexado automaticamente ao final.
                Ex: <span className="font-mono bg-gray-100 px-1 rounded">https://app.plataforma.com/?ref=</span>
              </p>
              <input
                type="url"
                value={form.plataforma_base_url}
                onChange={e => setField('plataforma_base_url', e.target.value)}
                placeholder="https://app.plataforma.com/?ref="
                className={inputCls}
              />
            </div>

            {/* Webhook URL da plataforma */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL do Webhook (para receber eventos)
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Cole essa URL no campo de webhook da sua plataforma (eventos USER_CREATED, DEPOSIT_CREATED).
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={plataformaWebhookUrl}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50 font-mono focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={copiarPlataformaWebhook}
                  className="shrink-0 text-sm font-medium text-white bg-gray-500 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors"
                >
                  {copiadoPlataforma ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Webhook Secret */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chave de Autorização (Bearer Token)
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Inclua no header <span className="font-mono bg-gray-100 px-1 rounded">Authorization: Bearer &lt;chave&gt;</span> das requisições da plataforma.
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  type={mostrarSecret ? 'text' : 'password'}
                  value={config?.webhook_secret ?? ''}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50 font-mono focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSecret(v => !v)}
                  className="shrink-0 text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors"
                  title={mostrarSecret ? 'Ocultar' : 'Mostrar'}
                >
                  {mostrarSecret ? '🙈' : '👁️'}
                </button>
                <button
                  type="button"
                  onClick={copiarSecret}
                  className="shrink-0 text-sm font-medium text-white bg-gray-500 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors"
                >
                  {copiadoSecret ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Feedback erro={erro} sucesso={sucesso} />
          <button type="submit" disabled={salvando} className="shrink-0 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
            {salvando ? tr('cfgSalvando') : tr('cfgSalvar')}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Seção: Leads ─────────────────────────────────────────────────────────────

interface Lead {
  id: number
  telefone: string
  nome: string | null
  email: string | null
  criado_em: string | null
  _count: { conversas: number }
}

function SecaoLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    fetch('/api/leads')
      .then(r => r.ok ? r.json() : [])
      .then((data: Lead[]) => { setLeads(data); setCarregando(false) })
  }, [])

  const filtrados = leads.filter(l => {
    const q = busca.toLowerCase()
    return !q || l.telefone.includes(q) || (l.nome ?? '').toLowerCase().includes(q)
  })

  async function exportarCSV() {
    setExportando(true)
    try {
      const res = await fetch('/api/leads/exportar')
      if (!res.ok) throw new Error('Erro ao exportar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportando(false)
    }
  }

  const comNome = leads.filter(l => l.nome).length
  const semNome = leads.length - comNome

  return (
    <div className="space-y-6">
      {/* Cards de métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Total de Leads</p>
          <p className="text-3xl font-bold text-gray-800">{leads.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Com Nome</p>
          <p className="text-3xl font-bold text-green-600">{comNome}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Sem Nome</p>
          <p className="text-3xl font-bold text-gray-400">{semNome}</p>
        </div>
      </div>

      {/* Barra de ações */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={exportarCSV}
          disabled={exportando || leads.length === 0}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          {exportando
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
          }
          Exportar CSV
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-base">
            Lista de Leads{' '}
            <span className="text-sm font-normal text-gray-400">
              ({busca ? `${filtrados.length} de ${leads.length}` : leads.length})
            </span>
          </h2>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <EmptyState icone="📋" texto={busca ? 'Nenhum lead encontrado para esta busca' : 'Nenhum lead cadastrado ainda'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefone</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversas</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Primeiro contato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-gray-700">{lead.telefone}</td>
                    <td className="px-6 py-3.5">
                      {lead.nome
                        ? <span className="text-gray-800">{lead.nome}</span>
                        : <span className="text-gray-300 italic text-xs">sem nome</span>
                      }
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                        {lead._count.conversas}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-400 text-xs">
                      {lead.criado_em
                        ? new Date(lead.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Seção: Métricas ─────────────────────────────────────────────────────────

interface MetricaRegistro {
  id: number
  nome_usuario: string | null
  email: string | null
  telefone: string | null
  data_evento: string | null
  operadores: { id: number; nome: string } | null
  leads: { id: number; nome: string | null; telefone: string } | null
}

interface MetricaOperador {
  operador: { id: number; nome: string }
  total: number
  leads: { id: number; nome: string | null; telefone: string }[]
}

interface MetricaDeposito extends MetricaRegistro {
  valor: number | null
  is_primeiro_deposito: boolean | null
  metodo_pagamento: string | null
  moeda: string | null
}

interface MetricasDepositos {
  total:      number
  totalValor: number
  lista:      MetricaDeposito[]
}

interface MetricasData {
  periodo: { inicio: string; fim: string }
  leadsAtendidos: { total: number; porOperador: MetricaOperador[] }
  registros: { total: number; lista: MetricaRegistro[] }
  depositos: {
    total:      number
    totalValor: number
    lista:      MetricaDeposito[]
    ftd:        MetricasDepositos
    redepositos: MetricasDepositos
  }
}

function SecaoMetricas() {
  const hoje = new Date().toISOString().slice(0, 10)
  const [inicio, setInicio] = useState(hoje)
  const [fim, setFim]       = useState(hoje)
  const [dados, setDados]   = useState<MetricasData | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [painelAberto, setPainelAberto] = useState<'atendidos' | 'registros' | 'ftd' | 'redepositos' | null>(null)

  async function carregar() {
    setCarregando(true)
    try {
      const res = await fetch(`/api/metricas?inicio=${inicio}&fim=${fim}`)
      if (res.ok) setDados(await res.json())
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const fmt = (d: string | null) => d
    ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Filtro de período */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">De</label>
          <input type="date" value={inicio} onChange={e => setInicio(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Até</label>
          <input type="date" value={fim} onChange={e => setFim(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <button onClick={carregar} disabled={carregando}
          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors flex items-center gap-2">
          {carregando
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>}
          Consultar
        </button>
      </div>

      {dados && (
        <>
          {/* Cards clicáveis */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => setPainelAberto(p => p === 'atendidos' ? null : 'atendidos')}
              className={`text-left bg-white rounded-2xl border shadow-sm px-6 py-5 transition-all hover:shadow-md ${painelAberto === 'atendidos' ? 'border-green-400 ring-2 ring-green-200' : 'border-gray-100'}`}>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Leads Atendidos</p>
              <p className="text-4xl font-bold text-gray-800">{dados.leadsAtendidos.total}</p>
              <p className="text-xs text-gray-400 mt-1">por {dados.leadsAtendidos.porOperador.length} operador(es)</p>
            </button>

            <button onClick={() => setPainelAberto(p => p === 'registros' ? null : 'registros')}
              className={`text-left bg-white rounded-2xl border shadow-sm px-6 py-5 transition-all hover:shadow-md ${painelAberto === 'registros' ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-100'}`}>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Registros</p>
              <p className="text-4xl font-bold text-blue-600">{dados.registros.total}</p>
              <p className="text-xs text-gray-400 mt-1">via link de afiliado</p>
            </button>

            <button onClick={() => setPainelAberto(p => p === 'ftd' ? null : 'ftd')}
              className={`text-left bg-white rounded-2xl border shadow-sm px-6 py-5 transition-all hover:shadow-md ${painelAberto === 'ftd' ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-gray-100'}`}>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Primeiros Depósitos</p>
              <p className="text-4xl font-bold text-emerald-600">{dados.depositos.ftd.total}</p>
              <p className="text-xs text-gray-400 mt-1">
                {dados.depositos.ftd.totalValor > 0
                  ? `$ ${dados.depositos.ftd.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : 'FTD'}
              </p>
            </button>

            <button onClick={() => setPainelAberto(p => p === 'redepositos' ? null : 'redepositos')}
              className={`text-left bg-white rounded-2xl border shadow-sm px-6 py-5 transition-all hover:shadow-md ${painelAberto === 'redepositos' ? 'border-violet-400 ring-2 ring-violet-200' : 'border-gray-100'}`}>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Redepósitos</p>
              <p className="text-4xl font-bold text-violet-600">{dados.depositos.redepositos.total}</p>
              <p className="text-xs text-gray-400 mt-1">
                {dados.depositos.redepositos.totalValor > 0
                  ? `$ ${dados.depositos.redepositos.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : 'depósitos recorrentes'}
              </p>
            </button>
          </div>

          {/* Painel de drill-down */}
          {painelAberto === 'atendidos' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Leads atendidos por operador</h3>
              </div>
              {dados.leadsAtendidos.porOperador.length === 0
                ? <EmptyState icone="👥" texto="Nenhum atendimento no período" />
                : dados.leadsAtendidos.porOperador.map(({ operador, total, leads }) => (
                  <details key={operador.id} className="border-b border-gray-50 last:border-0">
                    <summary className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-gray-50 list-none">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                          {operador.nome.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{operador.nome}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-700">{total} lead{total !== 1 ? 's' : ''}</span>
                    </summary>
                    <ul className="divide-y divide-gray-50 bg-gray-50/50 px-6 pb-2">
                      {leads.map(l => (
                        <li key={l.id} className="py-2 text-sm text-gray-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                          {l.nome ?? l.telefone}
                          {l.nome && <span className="text-xs text-gray-400 font-mono">{l.telefone}</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))
              }
            </div>
          )}

          {(painelAberto === 'ftd' || painelAberto === 'redepositos') && (() => {
            const isFTD   = painelAberto === 'ftd'
            const grupo   = isFTD ? dados.depositos.ftd : dados.depositos.redepositos
            const titulo  = isFTD ? 'Primeiros depósitos (FTD)' : 'Redepósitos'
            const cor     = isFTD ? 'text-emerald-600' : 'text-violet-600'
            return (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">{titulo}</h3>
                  {grupo.totalValor > 0 && (
                    <span className={`text-sm font-bold ${cor}`}>
                      Total: $ {grupo.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                {grupo.lista.length === 0
                  ? <EmptyState icone="💰" texto="Nenhum depósito no período" />
                  : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuário</th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Operador</th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {grupo.lista.map(ev => (
                            <tr key={ev.id} className="hover:bg-gray-50">
                              <td className="px-6 py-3">
                                <p className="font-medium text-gray-800">{ev.nome_usuario ?? ev.leads?.nome ?? '—'}</p>
                                <p className="text-xs text-gray-400">{ev.email ?? ''}</p>
                              </td>
                              <td className="px-6 py-3">
                                {ev.valor != null
                                  ? <span className={`font-bold ${cor}`}>$ {Number(ev.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                  : <span className="text-gray-300 italic text-xs">—</span>
                                }
                              </td>
                              <td className="px-6 py-3 text-gray-600">{ev.operadores?.nome ?? <span className="text-gray-300 italic text-xs">não vinculado</span>}</td>
                              <td className="px-6 py-3 text-gray-400 text-xs">{fmt(ev.data_evento)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </div>
            )
          })()}

          {painelAberto === 'registros' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Registros na plataforma</h3>
              </div>
              {dados.registros.lista.length === 0
                ? <EmptyState icone="✅" texto="Nenhum registro no período" />
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuário</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefone</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Operador</th>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {dados.registros.lista.map(ev => (
                          <tr key={ev.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3">
                              <p className="font-medium text-gray-800">{ev.nome_usuario ?? '—'}</p>
                              <p className="text-xs text-gray-400">{ev.email ?? ''}</p>
                            </td>
                            <td className="px-6 py-3 font-mono text-gray-600 text-xs">{ev.telefone ?? '—'}</td>
                            <td className="px-6 py-3 text-gray-600">{ev.operadores?.nome ?? <span className="text-gray-300 italic text-xs">não vinculado</span>}</td>
                            <td className="px-6 py-3 text-gray-400 text-xs">{fmt(ev.data_evento)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Campo com toggle mostrar/ocultar para dados sensíveis
function CampoSensivel({
  label, valor, onChange, placeholder, mascarado, dica
}: {
  label: string
  valor: string
  onChange: (v: string) => void
  placeholder: string
  mascarado: boolean
  dica: string
}) {
  const [visivel, setVisivel] = useState(false)

  return (
    <Field label={label}>
      {mascarado ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value="••••••••"
              className={`${inputCls} text-gray-400 bg-gray-50`}
            />
            <button
              type="button"
              onClick={() => onChange('')}
              className="shrink-0 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2.5 py-2 rounded-lg transition-colors"
              title="Apagar valor"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-amber-600">⚠ {dica}</p>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              type={visivel ? 'text' : 'password'}
              value={valor}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              className={`${inputCls} font-mono`}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setVisivel(v => !v)}
              className="shrink-0 text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-400 px-2.5 py-2 rounded-lg transition-colors text-xs"
            >
              {visivel ? '🙈' : '👁'}
            </button>
          </div>
        </div>
      )}
    </Field>
  )
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500'
const btnPrimario = 'w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors'

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="text-gray-400 font-normal ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function Feedback({ erro, sucesso }: { erro: string; sucesso: string }) {
  if (erro) return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
  if (sucesso) return <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{sucesso}</p>
  return null
}

function EmptyState({ icone, texto }: { icone: string; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <span className="text-4xl mb-3">{icone}</span>
      <p className="text-sm">{texto}</p>
    </div>
  )
}

function BotaoDeletar({ onClick, carregando }: { onClick: () => void; carregando: boolean }) {
  return (
    <button onClick={onClick} disabled={carregando}
      className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40 p-1 rounded-lg hover:bg-red-50" title="Deletar">
      {carregando
        ? <span className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin block" />
        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
      }
    </button>
  )
}
