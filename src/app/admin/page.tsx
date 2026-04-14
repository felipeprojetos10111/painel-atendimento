'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

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

const TIPOS = ['texto', 'imagem', 'audio', 'video', 'documento'] as const
type Tipo = typeof TIPOS[number]

const TIPO_CONFIG: Record<Tipo, { label: string; accept: string; icone: string; cor: string }> = {
  texto:     { label: 'Texto',     accept: '',                                                     icone: '💬', cor: 'bg-gray-100 text-gray-700' },
  imagem:    { label: 'Imagem',    accept: 'image/jpeg,image/png,image/webp,image/gif',            icone: '🖼️', cor: 'bg-blue-100 text-blue-700' },
  audio:     { label: 'Áudio',     accept: 'audio/mpeg,audio/ogg,audio/wav',                      icone: '🎵', cor: 'bg-purple-100 text-purple-700' },
  video:     { label: 'Vídeo',     accept: 'video/mp4,video/webm',                                icone: '🎬', cor: 'bg-red-100 text-red-700' },
  documento: { label: 'Documento', accept: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document', icone: '📄', cor: 'bg-yellow-100 text-yellow-700' }
}

const FORM_VAZIO = { titulo: '', categoria: '', tipo: 'texto' as Tipo, conteudo: '', atalho: '' }

export default function AdminPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [respostas, setRespostas] = useState<RespostaRapida[]>([])
  const [form, setForm] = useState(FORM_VAZIO)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [deletando, setDeletando] = useState<number | null>(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [busca, setBusca] = useState('')
  const [uploadProgresso, setUploadProgresso] = useState<string>('')

  async function carregar() {
    const res = await fetch('/api/respostas-rapidas?todos=true')
    const data = await res.json()
    setRespostas(data)
  }

  useEffect(() => { carregar() }, [])

  function setField(campo: keyof typeof FORM_VAZIO, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
    if (campo === 'tipo') {
      setArquivo(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    setSalvando(true)

    try {
      let url_midia: string | null = null

      // Upload de mídia se necessário
      if (form.tipo !== 'texto' && arquivo) {
        setUploadProgresso('Enviando arquivo...')

        // 1. Solicita URL pré-assinada
        const uploadRes = await fetch('/api/respostas-rapidas/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: arquivo.name, contentType: arquivo.type })
        })

        if (!uploadRes.ok) {
          const err = await uploadRes.json()
          throw new Error(err.erro ?? 'Erro ao gerar URL de upload.')
        }

        const { uploadUrl, urlPublica } = await uploadRes.json()

        // 2. Faz PUT direto no R2 com o arquivo
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': arquivo.type },
          body: arquivo
        })

        if (!putRes.ok) throw new Error('Falha no upload para o armazenamento.')

        url_midia = urlPublica
        setUploadProgresso('')
      }

      // 3. Cria a resposta rápida no banco
      const payload: Record<string, string | null> = {
        titulo: form.titulo,
        tipo: form.tipo,
        categoria: form.categoria || null,
        atalho: form.atalho || null,
        conteudo: form.tipo === 'texto' ? (form.conteudo || null) : null,
        url_midia
      }

      const res = await fetch('/api/respostas-rapidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.erro ?? 'Erro ao cadastrar.')
      }

      setSucesso('Resposta rápida cadastrada com sucesso!')
      setForm(FORM_VAZIO)
      setArquivo(null)
      if (fileRef.current) fileRef.current.value = ''
      await carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro desconhecido.')
    } finally {
      setSalvando(false)
      setUploadProgresso('')
    }
  }

  async function handleDeletar(id: number) {
    if (!confirm('Deletar esta resposta rápida?')) return
    setDeletando(id)
    await fetch(`/api/respostas-rapidas/${id}`, { method: 'DELETE' })
    setDeletando(null)
    await carregar()
  }

  const filtradas = respostas.filter(r =>
    !busca ||
    r.titulo.toLowerCase().includes(busca.toLowerCase()) ||
    r.categoria?.toLowerCase().includes(busca.toLowerCase()) ||
    r.atalho?.toLowerCase().includes(busca.toLowerCase())
  )

  const isMidia = form.tipo !== 'texto'

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
          <span className="font-semibold text-lg">Gerenciar Respostas Rápidas</span>
        </div>
        <span className="text-xs bg-green-700 px-2.5 py-1 rounded-full font-medium">supervisor</span>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* Formulário — col 2/5 */}
        <section className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-800 text-base mb-5">Nova resposta rápida</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setField('titulo', e.target.value)}
                  required
                  placeholder="Ex: Saudação inicial"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <input
                  type="text"
                  value={form.categoria}
                  onChange={e => setField('categoria', e.target.value)}
                  placeholder="Ex: Vendas, Suporte, Cobrança"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Atalho */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Atalho <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono">#</span>
                  <input
                    type="text"
                    value={form.atalho}
                    onChange={e => setField('atalho', e.target.value.replace(/\s/g, '').toLowerCase())}
                    placeholder="saudacao"
                    className="w-full pl-7 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <div className="grid grid-cols-5 gap-1">
                  {TIPOS.map(t => {
                    const cfg = TIPO_CONFIG[t]
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setField('tipo', t)}
                        className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                          form.tipo === t
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-base leading-none">{cfg.icone}</span>
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Conteúdo (texto) */}
              {!isMidia && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo</label>
                  <textarea
                    value={form.conteudo}
                    onChange={e => setField('conteudo', e.target.value)}
                    rows={4}
                    placeholder="Digite o texto da resposta rápida..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}

              {/* Upload de mídia */}
              {isMidia && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Arquivo de {TIPO_CONFIG[form.tipo].label} <span className="text-red-500">*</span>
                  </label>
                  <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl py-6 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                    <span className="text-2xl mb-1">{TIPO_CONFIG[form.tipo].icone}</span>
                    <span className="text-sm text-gray-500">
                      {arquivo ? arquivo.name : 'Clique para selecionar'}
                    </span>
                    {arquivo && (
                      <span className="text-xs text-gray-400 mt-0.5">
                        {(arquivo.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept={TIPO_CONFIG[form.tipo].accept}
                      onChange={e => setArquivo(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Feedback */}
              {erro && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {erro}
                </p>
              )}
              {sucesso && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  {sucesso}
                </p>
              )}

              <button
                type="submit"
                disabled={salvando || (isMidia && !arquivo)}
                className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                {salvando ? (uploadProgresso || 'Salvando...') : 'Cadastrar resposta'}
              </button>
            </form>
          </div>
        </section>

        {/* Lista — col 3/5 */}
        <section className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
              <h2 className="font-semibold text-gray-800 text-base shrink-0">
                Respostas cadastradas
                <span className="ml-2 text-sm font-normal text-gray-400">({filtradas.length})</span>
              </h2>
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Filtrar..."
                className="w-48 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {filtradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <span className="text-4xl mb-3">⚡</span>
                <p className="text-sm">Nenhuma resposta rápida cadastrada.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {filtradas.map(r => {
                  const cfg = TIPO_CONFIG[r.tipo as Tipo] ?? TIPO_CONFIG.texto
                  return (
                    <li key={r.id} className={`flex items-start gap-4 px-6 py-4 ${!r.ativo ? 'opacity-50' : ''}`}>
                      <span className="text-2xl mt-0.5 select-none">{cfg.icone}</span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-medium text-gray-800">{r.titulo}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.cor}`}>
                            {cfg.label}
                          </span>
                          {r.atalho && (
                            <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                              #{r.atalho}
                            </span>
                          )}
                          {r.categoria && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {r.categoria}
                            </span>
                          )}
                          {!r.ativo && (
                            <span className="text-xs text-gray-400 italic">inativa</span>
                          )}
                        </div>

                        {r.conteudo && (
                          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{r.conteudo}</p>
                        )}
                        {r.url_midia && (
                          <a
                            href={r.url_midia}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline truncate block max-w-xs"
                          >
                            {r.url_midia}
                          </a>
                        )}
                        <span className="text-xs text-gray-400 mt-1 block">
                          {r.criado_em ? new Date(r.criado_em).toLocaleDateString('pt-BR') : ''}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeletar(r.id)}
                        disabled={deletando === r.id}
                        className="shrink-0 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40 p-1 rounded-lg hover:bg-red-50"
                        title="Deletar"
                      >
                        {deletando === r.id
                          ? <span className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin block" />
                          : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        }
                      </button>
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
