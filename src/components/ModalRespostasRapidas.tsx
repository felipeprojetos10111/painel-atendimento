'use client'

import { useEffect, useRef, useState } from 'react'
import { useLingua } from '@/contexts/LinguaContext'

interface ItemResposta {
  id: number
  ordem: number
  tipo: string
  conteudo: string | null
  url_midia: string | null
}

interface RespostaRapida {
  id: number
  titulo: string
  categoria: string | null
  atalho: string | null
  itens: ItemResposta[]
  // campos legados (fallback para registros antigos sem itens)
  tipo?: string
  conteudo?: string | null
  url_midia?: string | null
}

interface Props {
  onSelecionar: (resposta: RespostaRapida) => void
  onFechar: () => void
}

const TIPO_ESTILO: Record<string, { cor: string; icone: string; chave: string }> = {
  texto:     { cor: 'bg-gray-100 text-gray-700',    icone: '💬', chave: 'tipoTexto' },
  imagem:    { cor: 'bg-blue-100 text-blue-700',    icone: '🖼️', chave: 'tipoImagem' },
  audio:     { cor: 'bg-purple-100 text-purple-700', icone: '🎵', chave: 'tipoAudio' },
  video:     { cor: 'bg-red-100 text-red-700',      icone: '🎬', chave: 'tipoVideo' },
  documento: { cor: 'bg-yellow-100 text-yellow-700', icone: '📄', chave: 'tipoDocumento' },
}

export default function ModalRespostasRapidas({ onSelecionar, onFechar }: Props) {
  const { tr } = useLingua()
  const [respostas, setRespostas] = useState<RespostaRapida[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()

    fetch('/api/respostas-rapidas')
      .then(r => r.json())
      .then(data => setRespostas(data))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onFechar])

  const filtradas = respostas.map(r => {
    // Normaliza: garante que itens existe (cria fallback para registros legados)
    const itens: ItemResposta[] = r.itens?.length
      ? r.itens
      : [{ id: 0, ordem: 0, tipo: r.tipo ?? 'texto', conteudo: r.conteudo ?? null, url_midia: r.url_midia ?? null }]
    return { ...r, itens }
  }).filter(r => {
    const termo = busca.toLowerCase().trim()
    if (!termo) return true
    if (termo.startsWith('#')) {
      const atalho = termo.slice(1)
      return r.atalho?.toLowerCase().includes(atalho) ?? false
    }
    const conteudoItens = r.itens.map(i => i.conteudo ?? '').join(' ')
    return (
      r.titulo.toLowerCase().includes(termo) ||
      conteudoItens.toLowerCase().includes(termo) ||
      r.categoria?.toLowerCase().includes(termo) ||
      r.atalho?.toLowerCase().includes(termo)
    )
  })

  const categorias = [...new Set(filtradas.map(r => r.categoria ?? tr('semCategoria')))]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onFechar() }}
    >
      <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <h2 className="font-semibold text-gray-800">{tr('respostasRapidasTitulo')}</h2>
          </div>
          <button
            onClick={onFechar}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Busca */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={tr('buscarRespostas')}
              className="w-full pl-9 pr-4 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {tr('dicaAtalho')}{' '}
            <span className="font-mono bg-gray-100 px-1 rounded">#atalho</span>{' '}
            {tr('dicaAtalhoMeio')}
          </p>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {carregando && (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              {tr('carregando')}
            </div>
          )}

          {!carregando && filtradas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <span className="text-3xl mb-2">🔍</span>
              <p className="text-sm">{tr('nenhumaRespostaEncontrada')}</p>
            </div>
          )}

          {!carregando && categorias.map(categoria => {
            const itens = filtradas.filter(r => (r.categoria ?? tr('semCategoria')) === categoria)
            return (
              <div key={categoria}>
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {categoria}
                  </span>
                </div>
                <ul className="divide-y divide-gray-50">
                  {itens.map(r => {
                    const primeiroItem = r.itens[0]
                    const cfgPrimeiro = TIPO_ESTILO[primeiroItem?.tipo ?? 'texto'] ?? TIPO_ESTILO.texto
                    const multiItens = r.itens.length > 1
                    const conteudoPreview = r.itens.find(i => i.conteudo)?.conteudo ?? null
                    const urlPreview = !conteudoPreview ? (r.itens.find(i => i.url_midia)?.url_midia ?? null) : null
                    return (
                      <li
                        key={r.id}
                        onClick={() => onSelecionar(r)}
                        className="flex items-start gap-3 px-5 py-3.5 cursor-pointer hover:bg-green-50 transition-colors group"
                      >
                        <span className="text-xl mt-0.5 select-none">{cfgPrimeiro.icone}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-800 truncate">
                              {r.titulo}
                            </span>
                            {/* Sequência de ícones dos itens */}
                            <span className="shrink-0 flex items-center gap-0.5 text-sm select-none">
                              {r.itens.map((item, idx) => {
                                const cfgItem = TIPO_ESTILO[item.tipo] ?? TIPO_ESTILO.texto
                                return <span key={idx}>{cfgItem.icone}</span>
                              })}
                            </span>
                            {multiItens && (
                              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700">
                                {r.itens.length} itens
                              </span>
                            )}
                            {r.atalho && (
                              <span className="shrink-0 text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                #{r.atalho}
                              </span>
                            )}
                          </div>
                          {conteudoPreview && (
                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                              {conteudoPreview}
                            </p>
                          )}
                          {urlPreview && (
                            <p className="text-xs text-blue-500 truncate">{urlPreview}</p>
                          )}
                        </div>
                        <svg
                          className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors shrink-0 mt-1"
                          fill="currentColor" viewBox="0 0 24 24"
                        >
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-400 text-center">
            {filtradas.length} {filtradas.length === 1 ? tr('respostaDisponivel') : tr('respostasDisponiveis')} · {tr('cliqueEnviar')}
          </p>
        </div>
      </div>
    </div>
  )
}
