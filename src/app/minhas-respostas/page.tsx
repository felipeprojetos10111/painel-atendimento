'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLingua } from '@/contexts/LinguaContext'

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

// ─── Config de tipos ──────────────────────────────────────────────────────────

const TIPOS = ['texto', 'imagem', 'audio', 'video', 'documento'] as const
type Tipo = typeof TIPOS[number]

const TIPO_CONFIG: Record<Tipo, { accept: string; icone: string; label: string }> = {
  texto:     { accept: '',                                                                                                           icone: '💬', label: 'Texto' },
  imagem:    { accept: 'image/jpeg,image/png,image/webp,image/gif',                                                                 icone: '🖼️', label: 'Imagem' },
  audio:     { accept: 'audio/mpeg,audio/ogg,audio/wav',                                                                            icone: '🎵', label: 'Áudio' },
  video:     { accept: 'video/mp4,video/webm,video/quicktime,video/x-msvideo,video/avi',                                            icone: '🎬', label: 'Vídeo' },
  documento: { accept: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document', icone: '📄', label: 'Doc' },
}

const TIPO_COR: Record<Tipo, string> = {
  texto:     'bg-gray-100 text-gray-700',
  imagem:    'bg-blue-100 text-blue-700',
  audio:     'bg-purple-100 text-purple-700',
  video:     'bg-red-100 text-red-700',
  documento: 'bg-yellow-100 text-yellow-700',
}

const FORM_VAZIO = { titulo: '', categoria: '', tipo: 'texto' as Tipo, conteudo: '', atalho: '' }

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MinhasRespostasPage() {
  const router = useRouter()
  const { tr } = useLingua()
  const fileRef = useRef<HTMLInputElement>(null)

  const [respostas, setRespostas]           = useState<RespostaRapida[]>([])
  const [form, setForm]                     = useState(FORM_VAZIO)
  const [editandoId, setEditandoId]         = useState<number | null>(null)
  const [arquivo, setArquivo]               = useState<File | null>(null)
  const [semTexto, setSemTexto]             = useState(false)
  const [salvando, setSalvando]             = useState(false)
  const [deletando, setDeletando]           = useState<number | null>(null)
  const [erro, setErro]                     = useState('')
  const [sucesso, setSucesso]               = useState('')
  const [busca, setBusca]                   = useState('')
  const [uploadProgresso, setUploadProgresso] = useState('')

  async function carregar() {
    const res = await fetch('/api/respostas-rapidas?todos=true')
    setRespostas(await res.json())
  }

  useEffect(() => { carregar() }, [])

  function setField(campo: keyof typeof FORM_VAZIO, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
    if (campo === 'tipo') {
      setArquivo(null)
      setSemTexto(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function iniciarEdicao(r: RespostaRapida) {
    setEditandoId(r.id)
    const tipoR = (r.tipo as Tipo) ?? 'texto'
    setForm({
      titulo:    r.titulo,
      categoria: r.categoria ?? '',
      tipo:      tipoR,
      conteudo:  r.conteudo ?? '',
      atalho:    r.atalho ?? '',
    })
    setSemTexto(tipoR !== 'texto' && !r.conteudo)
    setArquivo(null)
    setErro('')
    setSucesso('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setArquivo(null)
    setSemTexto(false)
    setErro('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSucesso(''); setSalvando(true)

    try {
      let url_midia: string | null = null

      if (form.tipo !== 'texto' && arquivo) {
        setUploadProgresso(form.tipo === 'video' ? 'Comprimindo e enviando vídeo...' : 'Enviando arquivo...')
        const fd = new FormData()
        fd.append('arquivo', arquivo)
        const uploadRes = await fetch('/api/respostas-rapidas/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) throw new Error((await uploadRes.json()).erro ?? 'Erro no upload')

        const { urlPublica } = await uploadRes.json()
        url_midia = urlPublica
        setUploadProgresso('')
      }

      const payload = {
        titulo:    form.titulo,
        tipo:      form.tipo,
        categoria: form.categoria || null,
        atalho:    form.atalho    || null,
        conteudo:  semTexto ? null : (form.conteudo || null),
        ...(url_midia && { url_midia })
      }

      if (editandoId) {
        const res = await fetch(`/api/respostas-rapidas/${editandoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error((await res.json()).erro ?? 'Erro ao atualizar')
        setSucesso('Resposta atualizada com sucesso!')
        setEditandoId(null)
      } else {
        const res = await fetch('/api/respostas-rapidas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error((await res.json()).erro ?? 'Erro ao cadastrar')
        setSucesso('Resposta cadastrada com sucesso!')
      }

      setForm(FORM_VAZIO)
      setArquivo(null)
      if (fileRef.current) fileRef.current.value = ''
      await carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSalvando(false); setUploadProgresso('')
    }
  }

  async function toggleAtivo(r: RespostaRapida) {
    await fetch(`/api/respostas-rapidas/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !r.ativo })
    })
    await carregar()
  }

  async function handleDeletar(r: RespostaRapida) {
    if (!confirm(`Deletar "${r.titulo}"? Esta ação não pode ser desfeita.`)) return
    setDeletando(r.id)
    await fetch(`/api/respostas-rapidas/${r.id}`, { method: 'DELETE' })
    setDeletando(null)
    if (editandoId === r.id) cancelarEdicao()
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
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-green-600 text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/painel')}
            className="hover:bg-green-700 p-1.5 rounded-lg transition-colors"
            title="Voltar ao painel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <span className="text-lg">⚡</span>
          <span className="font-semibold text-lg">Minhas Respostas Rápidas</span>
        </div>
        <span className="text-xs bg-green-700 px-2.5 py-1 rounded-full font-medium">
          {respostas.length} resposta{respostas.length !== 1 ? 's' : ''}
        </span>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* ── Formulário (criar / editar) ──────────────────────────────── */}
        <section className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-6">

            {/* Cabeçalho do formulário */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-800 text-base">
                {editandoId ? '✏️ Editar resposta' : '➕ Nova resposta'}
              </h2>
              {editandoId && (
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-400 px-2.5 py-1 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Título" required>
                <input type="text" value={form.titulo} onChange={e => setField('titulo', e.target.value)}
                  required placeholder="Ex: Catálogo de produtos" className={inputCls} />
              </Field>

              <Field label="Categoria">
                <input type="text" value={form.categoria} onChange={e => setField('categoria', e.target.value)}
                  placeholder="Ex: Vendas, Suporte" className={inputCls} />
              </Field>

              <Field label="Atalho" hint="opcional">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono">#</span>
                  <input type="text" value={form.atalho}
                    onChange={e => setField('atalho', e.target.value.replace(/\s/g, '').toLowerCase())}
                    placeholder="saudacao" className={`${inputCls} pl-7 font-mono`} />
                </div>
              </Field>

              {/* Seletor de tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <div className="grid grid-cols-5 gap-1">
                  {TIPOS.map(t => (
                    <button key={t} type="button" onClick={() => setField('tipo', t)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        form.tipo === t
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                      }`}>
                      <span className="text-base leading-none">{TIPO_CONFIG[t].icone}</span>
                      {TIPO_CONFIG[t].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conteúdo de texto */}
              {!isMidia && (
                <Field label="Conteúdo">
                  <textarea value={form.conteudo} onChange={e => setField('conteudo', e.target.value)}
                    rows={4} placeholder="Digite o texto da resposta..."
                    className={`${inputCls} resize-none`} />
                </Field>
              )}

              {/* Texto anexado à mídia (opcional) — não disponível para áudio */}
              {isMidia && form.tipo !== 'audio' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Texto anexado à mídia
                      <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={semTexto}
                        onChange={e => {
                          setSemTexto(e.target.checked)
                          if (e.target.checked) setField('conteudo', '')
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-xs text-gray-500">Sem texto</span>
                    </label>
                  </div>
                  {!semTexto ? (
                    <textarea
                      value={form.conteudo}
                      onChange={e => setField('conteudo', e.target.value)}
                      rows={3}
                      placeholder="Ex: Confira nosso catálogo completo! 😊"
                      className={`${inputCls} resize-none`}
                    />
                  ) : (
                    <p className="text-xs text-gray-400 italic bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      Nenhum texto será enviado junto com o arquivo.
                    </p>
                  )}
                </div>
              )}

              {/* Upload de mídia */}
              {isMidia && (
                <Field label={`Arquivo de ${TIPO_CONFIG[form.tipo].label}`}
                  required={!editandoId}>
                  <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl py-6 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                    <span className="text-2xl mb-1">{TIPO_CONFIG[form.tipo].icone}</span>
                    <span className="text-sm text-gray-500">
                      {arquivo ? arquivo.name : editandoId ? 'Clique para substituir o arquivo' : 'Clique para selecionar'}
                    </span>
                    {arquivo && (
                      <span className="text-xs text-gray-400 mt-0.5">{(arquivo.size / 1024 / 1024).toFixed(2)} MB</span>
                    )}
                    <input ref={fileRef} type="file" accept={TIPO_CONFIG[form.tipo].accept}
                      onChange={e => setArquivo(e.target.files?.[0] ?? null)} className="hidden" />
                  </label>
                  {editandoId && !arquivo && (
                    <p className="text-xs text-gray-400 mt-1">Deixe vazio para manter o arquivo atual</p>
                  )}
                </Field>
              )}

              {/* Feedback */}
              {erro   && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
              {sucesso && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{sucesso}</p>}

              <button
                type="submit"
                disabled={salvando || (isMidia && !arquivo && !editandoId)}
                className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                {salvando
                  ? (uploadProgresso || (editandoId ? 'Salvando...' : 'Cadastrando...'))
                  : (editandoId ? 'Salvar alterações' : 'Cadastrar resposta')}
              </button>
            </form>
          </div>
        </section>

        {/* ── Lista de respostas ───────────────────────────────────────── */}
        <section className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
              <h2 className="font-semibold text-gray-800 text-base shrink-0">
                Minhas respostas
                <span className="text-sm font-normal text-gray-400 ml-1.5">({filtradas.length})</span>
              </h2>
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Filtrar..." className="w-44 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>

            {filtradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <span className="text-4xl mb-3">⚡</span>
                <p className="text-sm">Nenhuma resposta cadastrada ainda.</p>
                <p className="text-xs mt-1">Use o formulário ao lado para criar a sua primeira.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {filtradas.map(r => {
                  const cfg = TIPO_CONFIG[r.tipo as Tipo] ?? TIPO_CONFIG.texto
                  const cor = TIPO_COR[r.tipo as Tipo]   ?? TIPO_COR.texto
                  const editando = editandoId === r.id
                  return (
                    <li
                      key={r.id}
                      className={`flex items-start gap-4 px-6 py-4 transition-colors ${
                        editando ? 'bg-green-50 border-l-4 border-l-green-500' : !r.ativo ? 'opacity-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-2xl mt-0.5 select-none">{cfg.icone}</span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-medium text-gray-800">{r.titulo}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cor}`}>{cfg.label}</span>
                          {r.atalho && (
                            <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{r.atalho}</span>
                          )}
                          {r.categoria && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{r.categoria}</span>
                          )}
                          {!r.ativo && <span className="text-xs text-gray-400 italic">inativa</span>}
                        </div>
                        {r.conteudo && (
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {r.tipo !== 'texto' && <span className="text-gray-400 mr-1">💬</span>}
                            {r.conteudo}
                          </p>
                        )}
                        {r.tipo !== 'texto' && !r.conteudo && (
                          <p className="text-xs text-gray-400 italic">sem texto anexado</p>
                        )}
                        {r.url_midia && (
                          <a href={r.url_midia} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline truncate block max-w-xs">{r.url_midia}</a>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Toggle ativo */}
                        <button
                          onClick={() => toggleAtivo(r)}
                          title={r.ativo ? 'Desativar' : 'Ativar'}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${r.ativo ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${r.ativo ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>

                        {/* Editar */}
                        <button
                          onClick={() => iniciarEdicao(r)}
                          title="Editar"
                          className={`p-1.5 rounded-lg transition-colors ${editando ? 'text-green-600 bg-green-100' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        {/* Deletar */}
                        <button
                          onClick={() => handleDeletar(r)}
                          disabled={deletando === r.id}
                          title="Deletar"
                          className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40 p-1.5 rounded-lg hover:bg-red-50"
                        >
                          {deletando === r.id
                            ? <span className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin block" />
                            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                          }
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500'

function Field({ label, children, required, hint }: {
  label: string; children: React.ReactNode; required?: boolean; hint?: string
}) {
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
