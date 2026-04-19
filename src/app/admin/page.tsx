'use client'

import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useLingua } from '@/contexts/LinguaContext'
import SeletorLingua from '@/components/SeletorLingua'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RespostaRapida {
  id: number
  titulo: string
  tipo: string
  conteudo: string | null
  url_midia: string | null
  categoria: string | null
  atalho: string | null
  ativo: boolean | null
  criado_em: string | null
}

interface Operador {
  id: number
  nome: string
  email: string
  nivel: string | null
  ativo: boolean | null
  criado_em: string | null
  conversasAtivas: number
}

// ─── Config de tipos de resposta ──────────────────────────────────────────────

const TIPOS = ['texto', 'imagem', 'audio', 'video', 'documento'] as const
type Tipo = typeof TIPOS[number]

const TIPO_CONFIG: Record<Tipo, { accept: string; icone: string; chave: string }> = {
  texto:     { accept: '',                                                                                                              icone: '💬', chave: 'tipoTexto' },
  imagem:    { accept: 'image/jpeg,image/png,image/webp,image/gif',                                                                    icone: '🖼️', chave: 'tipoImagem' },
  audio:     { accept: 'audio/mpeg,audio/ogg,audio/wav',                                                                               icone: '🎵', chave: 'tipoAudio' },
  video:     { accept: 'video/mp4,video/webm',                                                                                         icone: '🎬', chave: 'tipoVideo' },
  documento: { accept: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',    icone: '📄', chave: 'tipoDocumento' },
}

const TIPO_COR: Record<Tipo, string> = {
  texto:     'bg-gray-100 text-gray-700',
  imagem:    'bg-blue-100 text-blue-700',
  audio:     'bg-purple-100 text-purple-700',
  video:     'bg-red-100 text-red-700',
  documento: 'bg-yellow-100 text-yellow-700',
}

const FORM_RESPOSTA_VAZIO = { titulo: '', categoria: '', tipo: 'texto' as Tipo, conteudo: '', atalho: '' }
const FORM_OPERADOR_VAZIO = { nome: '', email: '', senha: '', nivel: 'operador' }

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const { tr } = useLingua()
  const [aba, setAba] = useState<'respostas' | 'operadores' | 'ia'>('respostas')

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

      {/* Abas */}
      <div className="border-b border-gray-200 bg-white px-6">
        <nav className="flex gap-1 -mb-px">
          {([
            { key: 'respostas', chave: 'abaRespostas' },
            { key: 'operadores', chave: 'abaOperadores' },
            { key: 'ia', chave: 'abaIA' },
          ] as const).map(({ key, chave }) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                aba === key
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tr(chave)}
            </button>
          ))}
        </nav>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {aba === 'respostas' && <SecaoRespostas />}
        {aba === 'operadores' && <SecaoOperadores />}
        {aba === 'ia' && <SecaoIA />}
      </div>
    </div>
  )
}

// ─── Seção: Respostas Rápidas ─────────────────────────────────────────────────

function SecaoRespostas() {
  const { tr } = useLingua()
  const fileRef = useRef<HTMLInputElement>(null)
  const [respostas, setRespostas] = useState<RespostaRapida[]>([])
  const [form, setForm] = useState(FORM_RESPOSTA_VAZIO)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [deletando, setDeletando] = useState<number | null>(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [busca, setBusca] = useState('')
  const [uploadProgresso, setUploadProgresso] = useState('')

  async function carregar() {
    const res = await fetch('/api/respostas-rapidas?todos=true')
    setRespostas(await res.json())
  }

  useEffect(() => { carregar() }, [])

  function setField(campo: keyof typeof FORM_RESPOSTA_VAZIO, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
    if (campo === 'tipo') {
      setArquivo(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSucesso(''); setSalvando(true)

    try {
      let url_midia: string | null = null

      if (form.tipo !== 'texto' && arquivo) {
        setUploadProgresso(tr('enviandoArquivo'))

        const uploadRes = await fetch('/api/respostas-rapidas/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: arquivo.name, contentType: arquivo.type })
        })
        if (!uploadRes.ok) throw new Error((await uploadRes.json()).erro ?? tr('erroDesconhecido'))

        const { uploadUrl, urlPublica } = await uploadRes.json()
        const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': arquivo.type }, body: arquivo })
        if (!putRes.ok) throw new Error(tr('erroDesconhecido'))

        url_midia = urlPublica
        setUploadProgresso('')
      }

      const res = await fetch('/api/respostas-rapidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: form.titulo,
          tipo: form.tipo,
          categoria: form.categoria || null,
          atalho: form.atalho || null,
          conteudo: form.tipo === 'texto' ? (form.conteudo || null) : null,
          url_midia
        })
      })
      if (!res.ok) throw new Error((await res.json()).erro ?? tr('erroDesconhecido'))

      setSucesso(tr('sucessoResposta'))
      setForm(FORM_RESPOSTA_VAZIO)
      setArquivo(null)
      if (fileRef.current) fileRef.current.value = ''
      await carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr('erroDesconhecido'))
    } finally {
      setSalvando(false); setUploadProgresso('')
    }
  }

  async function handleDeletar(id: number) {
    if (!confirm(tr('confirmarDeletarResposta'))) return
    setDeletando(id)
    await fetch(`/api/respostas-rapidas/${id}`, { method: 'DELETE' })
    setDeletando(null)
    await carregar()
  }

  const isMidia = form.tipo !== 'texto'
  const filtradas = respostas.filter(r =>
    !busca ||
    r.titulo.toLowerCase().includes(busca.toLowerCase()) ||
    r.categoria?.toLowerCase().includes(busca.toLowerCase()) ||
    r.atalho?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Formulário */}
      <section className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 text-base mb-5">{tr('novaRespostaRapida')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">

            <Field label={tr('tituloField')} required>
              <input type="text" value={form.titulo} onChange={e => setField('titulo', e.target.value)}
                required placeholder="Ex: Saudação inicial" className={inputCls} />
            </Field>

            <Field label={tr('categoriaField')}>
              <input type="text" value={form.categoria} onChange={e => setField('categoria', e.target.value)}
                placeholder="Ex: Vendas, Suporte" className={inputCls} />
            </Field>

            <Field label={tr('atalhoField')} hint={tr('opcional')}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono">#</span>
                <input type="text" value={form.atalho}
                  onChange={e => setField('atalho', e.target.value.replace(/\s/g, '').toLowerCase())}
                  placeholder="saudacao" className={`${inputCls} pl-7 font-mono`} />
              </div>
            </Field>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{tr('tipoField')}</label>
              <div className="grid grid-cols-5 gap-1">
                {TIPOS.map(t => (
                  <button key={t} type="button" onClick={() => setField('tipo', t)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      form.tipo === t ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}>
                    <span className="text-base leading-none">{TIPO_CONFIG[t].icone}</span>
                    {tr(TIPO_CONFIG[t].chave)}
                  </button>
                ))}
              </div>
            </div>

            {!isMidia && (
              <Field label={tr('conteudoField')}>
                <textarea value={form.conteudo} onChange={e => setField('conteudo', e.target.value)}
                  rows={4} placeholder={tr('conteudoPlaceholder')}
                  className={`${inputCls} resize-none`} />
              </Field>
            )}

            {isMidia && (
              <Field label={`${tr('arquivoDe')} ${tr(TIPO_CONFIG[form.tipo].chave)}`} required>
                <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl py-6 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                  <span className="text-2xl mb-1">{TIPO_CONFIG[form.tipo].icone}</span>
                  <span className="text-sm text-gray-500">{arquivo ? arquivo.name : tr('cliqueSelecionarArquivo')}</span>
                  {arquivo && <span className="text-xs text-gray-400 mt-0.5">{(arquivo.size / 1024 / 1024).toFixed(2)} MB</span>}
                  <input ref={fileRef} type="file" accept={TIPO_CONFIG[form.tipo].accept}
                    onChange={e => setArquivo(e.target.files?.[0] ?? null)} className="hidden" />
                </label>
              </Field>
            )}

            <Feedback erro={erro} sucesso={sucesso} />

            <button type="submit" disabled={salvando || (isMidia && !arquivo)} className={btnPrimario}>
              {salvando ? (uploadProgresso || tr('salvando')) : tr('cadastrarResposta')}
            </button>
          </form>
        </div>
      </section>

      {/* Lista */}
      <section className="lg:col-span-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <h2 className="font-semibold text-gray-800 text-base shrink-0">
              {tr('respostasCadastradas')} <span className="text-sm font-normal text-gray-400">({filtradas.length})</span>
            </h2>
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder={tr('filtrarPlaceholder')} className="w-44 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          {filtradas.length === 0 ? (
            <EmptyState icone="⚡" texto={tr('nenhumaRespostaCadastrada')} />
          ) : (
            <ul className="divide-y divide-gray-50">
              {filtradas.map(r => {
                const cfg = TIPO_CONFIG[r.tipo as Tipo] ?? TIPO_CONFIG.texto
                const cor = TIPO_COR[r.tipo as Tipo] ?? TIPO_COR.texto
                return (
                  <li key={r.id} className={`flex items-start gap-4 px-6 py-4 ${!r.ativo ? 'opacity-50' : ''}`}>
                    <span className="text-2xl mt-0.5 select-none">{cfg.icone}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-gray-800">{r.titulo}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cor}`}>{tr(cfg.chave)}</span>
                        {r.atalho && <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{r.atalho}</span>}
                        {r.categoria && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{r.categoria}</span>}
                        {!r.ativo && <span className="text-xs text-gray-400 italic">{tr('inativa')}</span>}
                      </div>
                      {r.conteudo && <p className="text-xs text-gray-500 line-clamp-2">{r.conteudo}</p>}
                      {r.url_midia && (
                        <a href={r.url_midia} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline truncate block max-w-xs">{r.url_midia}</a>
                      )}
                      <span className="text-xs text-gray-400 mt-1 block">
                        {r.criado_em ? new Date(r.criado_em).toLocaleDateString('pt-BR') : ''}
                      </span>
                    </div>
                    <BotaoDeletar onClick={() => handleDeletar(r.id)} carregando={deletando === r.id} />
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
  resposta: string
  acao: string
  intencao: string
  urgencia: string
}

const PROMPT_PADRAO = 'Você é um assistente de atendimento ao cliente prestativo e profissional. Analise a mensagem do lead e responda em JSON com os campos: resposta (mensagem para enviar ao lead), acao (resolver se você consegue ajudar sozinho, ou escalar se precisa de um humano), intencao (o que o lead quer em poucas palavras), urgencia (baixa, media ou alta). Sempre responda APENAS com JSON válido, sem texto adicional.'

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
    setTesteErro(''); setTesteResultado(null); setTestando(true)
    try {
      const res = await fetch('/api/ia/testar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: testeMensagem, prompt_sistema: prompt })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? tr('erroDesconhecido'))
      setTesteResultado(data.decisao)
      setTesteFoiRealizado(true)
    } catch (err) {
      setTesteErro(err instanceof Error ? err.message : tr('erroDesconhecido'))
    } finally {
      setTestando(false)
    }
  }

  const charCount = prompt.length
  const charMax = 8000

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
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{testeErro}</p>
        )}

        {testeResultado && (
          <div className={`rounded-xl border-2 p-4 ${testeResultado.acao === 'resolver' ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${testeResultado.acao === 'resolver' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                {testeResultado.acao === 'resolver' ? `✓ ${tr('iaAcaoResolver')}` : `⚡ ${tr('iaAcaoEscalar')}`}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                testeResultado.urgencia === 'alta' ? 'bg-red-100 text-red-700' :
                testeResultado.urgencia === 'media' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                Urgência: {testeResultado.urgencia}
              </span>
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resposta da IA</span>
                <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{testeResultado.resposta}</p>
              </div>
              {testeResultado.intencao && (
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Intenção detectada</span>
                  <p className="text-sm text-gray-600 mt-0.5">{testeResultado.intencao}</p>
                </div>
              )}
            </div>
          </div>
        )}

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
