'use client'

/**
 * FluxoBuilder — editor visual de fluxos de atendimento
 * Timeline vertical: cada etapa tem o que é enviado + o que é esperado + roteamento
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoEnvio = 'texto' | 'imagem' | 'video' | 'audio' | 'link_afiliado' | 'escalar' | 'encerrar'
type TipoEspera = 'keywords' | 'qualquer' | 'numero'
type TipoNoMatch = 'agente' | 'aguardar' | 'encerrar' | 'escalar'

interface EnvioConfig {
  tipo: TipoEnvio
  conteudo: string      // texto ou legenda de mídia
  url: string           // URL de mídia
  mensagem_pre: string  // prefixo para link afiliado
}

interface EsperarConfig {
  tipo: TipoEspera
  keywords: string[]
  descricao: string   // contexto para a IA avaliar semanticamente
  salvar_como: string // salva a resposta do lead como variável
}

interface NoMatchConfig {
  tipo: TipoNoMatch
  agente_prompt: string
  apos_recuperar: string // id da etapa ou destino especial
  apos_falhar: string
}

interface Etapa {
  id: string
  nome: string
  envios: EnvioConfig[]   // múltiplos itens de envio por etapa
  aguardar: boolean
  esperar: EsperarConfig
  se_match: string        // id da próxima etapa
  se_no_match: NoMatchConfig | null
}

interface AgenteConfig {
  prompt_base: string
  operador_escalacao_id: number | null
  recuperacao: {
    ativo: boolean
    horas_espera: number
    max_tentativas: number
  }
}

interface OperadorItem {
  id: number
  nome: string
}

interface FluxoBuilderProps {
  fluxoId: number
  nomeInicial: string
  definicaoInicial: Record<string, unknown> | null
  onClose: () => void
  onSaved: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DESTINOS_ESPECIAIS = [
  { id: '__proximo__', label: 'Próxima etapa (padrão)' },
  { id: '__sucesso__', label: '✅ Finalizar (sucesso)' },
  { id: '__perdida__', label: '❌ Finalizar (sem interesse)' },
  { id: '__escalar__', label: '👤 Escalar para operador' },
]

const envioDefault = (): EnvioConfig => ({ tipo: 'texto', conteudo: '', url: '', mensagem_pre: '' })

function novaEtapa(index: number): Etapa {
  return {
    id: `etapa_${Date.now()}_${index}`,
    nome: `Etapa ${index + 1}`,
    envios: [envioDefault()],
    aguardar: true,
    esperar: { tipo: 'keywords', keywords: [], descricao: '', salvar_como: '' },
    se_match: '__proximo__',
    se_no_match: null,
  }
}

function builderParaDefinicao(etapas: Etapa[], agente: AgenteConfig): Record<string, unknown> {
  const estagios: Record<string, unknown> = {}

  const resolveDestino = (dest: string, indexAtual: number): string => {
    if (dest === '__proximo__') return etapas[indexAtual + 1]?.id ?? '__sucesso__'
    if (dest === '__sucesso__') return '_sucesso_'
    if (dest === '__perdida__') return '_perdida_'
    if (dest === '__escalar__') return '_escalar_'
    return dest
  }

  for (let i = 0; i < etapas.length; i++) {
    const e = etapas[i]
    const matchDest = resolveDestino(e.se_match, i)
    const primeiroEnvio = e.envios[0]

    if (e.envios.length === 1 && primeiroEnvio?.tipo === 'link_afiliado') {
      estagios[e.id] = {
        tipo: 'acao', nome: e.nome,
        acao: 'enviar_link_afiliado',
        mensagem_pre: primeiroEnvio.mensagem_pre,
        proximo: matchDest,
      }
    } else if (e.envios.length === 1 && primeiroEnvio?.tipo === 'escalar') {
      estagios[e.id] = { tipo: 'acao', nome: e.nome, acao: 'escalar' }
    } else if (e.envios.length === 1 && primeiroEnvio?.tipo === 'encerrar') {
      estagios[e.id] = { tipo: 'acao', nome: e.nome, acao: 'finalizar_sucesso' }
    } else {
      const noMatch = e.se_no_match
        ? {
            tipo: e.se_no_match.tipo,
            agente_prompt: e.se_no_match.agente_prompt,
            apos_recuperar: resolveDestino(e.se_no_match.apos_recuperar, i),
            apos_falhar: resolveDestino(e.se_no_match.apos_falhar, i),
          }
        : null

      estagios[e.id] = {
        tipo: 'interacao',
        nome: e.nome,
        envios: e.envios.map(env => ({
          tipo: env.tipo,
          conteudo: env.conteudo || undefined,
          url: env.url || undefined,
          legenda: env.conteudo || undefined,
          mensagem_pre: env.mensagem_pre || undefined,
        })),
        aguardar: e.aguardar,
        esperar: e.aguardar
          ? {
              tipo: e.esperar.tipo,
              keywords: e.esperar.keywords,
              descricao: e.esperar.descricao,
              salvar_como: e.esperar.salvar_como || null,
            }
          : null,
        se_match: matchDest,
        se_no_match: noMatch,
      }
    }
  }

  // Terminadores fixos
  estagios['_sucesso_'] = { tipo: 'acao', acao: 'finalizar_sucesso' }
  estagios['_perdida_'] = { tipo: 'acao', acao: 'finalizar_perdida' }
  estagios['_escalar_'] = { tipo: 'acao', acao: 'escalar' }

  return {
    estagio_inicial: etapas[0]?.id ?? '_sucesso_',
    agente,
    estagios,
  }
}

function definicaoParaBuilder(def: Record<string, unknown>): { etapas: Etapa[]; agente: AgenteConfig } {
  const estagios = (def.estagios ?? {}) as Record<string, Record<string, unknown>>
  const terminais = ['_sucesso_', '_perdida_', '_escalar_']
  const etapas: Etapa[] = []
  const visitados = new Set<string>()

  let current = def.estagio_inicial as string
  while (current && !terminais.includes(current) && !visitados.has(current)) {
    visitados.add(current)
    const est = estagios[current]
    if (!est) break

    const toDestUI = (dest: string): string => {
      if (dest === '_sucesso_') return '__sucesso__'
      if (dest === '_perdida_') return '__perdida__'
      if (dest === '_escalar_') return '__escalar__'
      return dest
    }

    const nm = est.se_no_match as Record<string, unknown> | null | undefined

    // Constrói array de envios — suporta formato novo (envios[]) e antigo (enviar{})
    let envios: EnvioConfig[]
    if (Array.isArray(est.envios) && est.envios.length > 0) {
      // Formato novo
      envios = (est.envios as Record<string, unknown>[]).map(env => ({
        tipo: (env.tipo as TipoEnvio) ?? 'texto',
        conteudo: (env.conteudo as string) || (env.legenda as string) || '',
        url: (env.url as string) || '',
        mensagem_pre: (env.mensagem_pre as string) || '',
      }))
    } else {
      // Formato antigo (enviar{}) ou estágio de ação
      let tipoEnvio: TipoEnvio = 'texto'
      const enviar = est.enviar as Record<string, unknown> | undefined
      if (est.acao === 'enviar_link_afiliado') tipoEnvio = 'link_afiliado'
      else if (est.acao === 'escalar') tipoEnvio = 'escalar'
      else if (est.acao === 'finalizar_sucesso' || est.acao === 'finalizar_perdida') tipoEnvio = 'encerrar'
      else if (enviar?.tipo) tipoEnvio = enviar.tipo as TipoEnvio
      envios = [{
        tipo: tipoEnvio,
        conteudo: (est.enviar as Record<string, unknown> | undefined)?.conteudo as string || (est.enviar as Record<string, unknown> | undefined)?.legenda as string || (est.mensagem_pre as string) || '',
        url: (est.enviar as Record<string, unknown> | undefined)?.url as string || '',
        mensagem_pre: (est.mensagem_pre as string) || '',
      }]
    }

    const esperar = est.esperar as Record<string, unknown> | null | undefined

    etapas.push({
      id: current,
      nome: (est.nome as string) || current,
      envios,
      aguardar: (est.aguardar as boolean) ?? true,
      esperar: {
        tipo: (esperar?.tipo as TipoEspera) ?? 'keywords',
        keywords: (esperar?.keywords as string[]) ?? [],
        descricao: (esperar?.descricao as string) ?? '',
        salvar_como: (esperar?.salvar_como as string) ?? '',
      },
      se_match: toDestUI((est.se_match as string) || '__proximo__'),
      se_no_match: nm
        ? {
            tipo: (nm.tipo as TipoNoMatch) ?? 'agente',
            agente_prompt: (nm.agente_prompt as string) ?? '',
            apos_recuperar: toDestUI((nm.apos_recuperar as string) ?? '__proximo__'),
            apos_falhar: toDestUI((nm.apos_falhar as string) ?? '__perdida__'),
          }
        : null,
    })

    current = est.se_match as string
  }

  const ag = def.agente as Record<string, unknown> | undefined
  const rec = ag?.recuperacao as Record<string, unknown> | undefined

  return {
    etapas,
    agente: {
      prompt_base: (ag?.prompt_base as string) ?? '',
      operador_escalacao_id: (ag?.operador_escalacao_id as number | null) ?? null,
      recuperacao: {
        ativo: (rec?.ativo as boolean) ?? true,
        horas_espera: (rec?.horas_espera as number) ?? 3,
        max_tentativas: (rec?.max_tentativas as number) ?? 2,
      },
    },
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

const LABEL_IDIOMAS: Record<string, string> = {
  pt: '🇧🇷 Português', en: '🇺🇸 English', es: '🇪🇸 Español',
}

export default function FluxoBuilder({ fluxoId, nomeInicial, definicaoInicial, onClose, onSaved }: FluxoBuilderProps) {
  const init = definicaoInicial ? definicaoParaBuilder(definicaoInicial) : { etapas: [novaEtapa(0)], agente: { prompt_base: '', operador_escalacao_id: null, recuperacao: { ativo: true, horas_espera: 3, max_tentativas: 2 } } }
  const idiomaSalvo = (definicaoInicial?.idioma as string) ?? 'pt'

  const [nome, setNome] = useState(nomeInicial)
  const [idioma] = useState(idiomaSalvo)
  const [etapas, setEtapas] = useState<Etapa[]>(init.etapas.length > 0 ? init.etapas : [novaEtapa(0)])
  const [agente, setAgente] = useState<AgenteConfig>(init.agente)
  const [salvando, setSalvando] = useState(false)
  const [agenteAberto, setAgenteAberto] = useState(false)
  const [operadores, setOperadores] = useState<OperadorItem[]>([])

  useEffect(() => {
    fetch('/api/operadores')
      .then(r => r.json())
      .then((lista: OperadorItem[]) => setOperadores(Array.isArray(lista) ? lista : []))
      .catch(() => {})
  }, [])

  // ── CRUD de etapas ──────────────────────────────────────────────────────────

  const adicionarEtapa = (aposIndex: number) => {
    setEtapas(prev => {
      const nova = [...prev]
      nova.splice(aposIndex + 1, 0, novaEtapa(aposIndex + 1))
      return nova
    })
  }

  const removerEtapa = (index: number) => {
    if (etapas.length <= 1) return
    setEtapas(prev => prev.filter((_, i) => i !== index))
  }

  const moverEtapa = (index: number, dir: -1 | 1) => {
    setEtapas(prev => {
      const nova = [...prev]
      const target = index + dir
      if (target < 0 || target >= nova.length) return prev
      ;[nova[index], nova[target]] = [nova[target], nova[index]]
      return nova
    })
  }

  const atualizarEtapa = useCallback((index: number, patch: Partial<Etapa>) => {
    setEtapas(prev => prev.map((e, i) => i === index ? { ...e, ...patch } : e))
  }, [])

  // ── Salvar ──────────────────────────────────────────────────────────────────

  async function salvar() {
    setSalvando(true)
    try {
      const definicao = { ...builderParaDefinicao(etapas, agente), idioma }
      await fetch(`/api/fluxos/${fluxoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, definicao }),
      })
      onSaved()
    } finally {
      setSalvando(false)
    }
  }

  // ── Opções de destino para selects ─────────────────────────────────────────

  const opcoesDestino = [
    ...DESTINOS_ESPECIAIS,
    ...etapas.map((e, i) => ({ id: e.id, label: `Etapa ${i + 1}: ${e.nome}` })),
  ]

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col overflow-hidden">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shrink-0">
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <input
          value={nome}
          onChange={e => setNome(e.target.value)}
          className="flex-1 text-lg font-semibold text-gray-900 bg-transparent border-none outline-none focus:bg-gray-100 rounded px-2 py-0.5"
          placeholder="Nome do fluxo"
        />
        <span className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg shrink-0" title="Idioma configurado no fluxo">
          🌐 {LABEL_IDIOMAS[idioma] ?? idioma}
        </span>
        <button
          onClick={() => setAgenteAberto(v => !v)}
          className="flex items-center gap-1.5 text-sm text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          🤖 Agente IA
        </button>
        <button
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {salvando && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          Salvar fluxo
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Painel do Agente (sidebar direita) */}
        {agenteAberto && (
          <div className="w-80 bg-white border-l border-gray-200 p-5 overflow-y-auto shrink-0 order-2">
            <h3 className="font-semibold text-gray-900 mb-4">🤖 Configuração do Agente IA</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Prompt base (personalidade e contexto)
                </label>
                <textarea
                  value={agente.prompt_base}
                  onChange={e => setAgente(a => ({ ...a, prompt_base: e.target.value }))}
                  rows={6}
                  placeholder="Ex: Você é um consultor da Roos Trader. Seja direto, empático e nunca pressione o lead."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-purple-300 focus:outline-none"
                />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  👤 Operador de escalação (teste)
                </label>
                <select
                  value={agente.operador_escalacao_id ?? ''}
                  onChange={e => setAgente(a => ({ ...a, operador_escalacao_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none"
                >
                  <option value="">— Fila geral (padrão) —</option>
                  {operadores.map(op => (
                    <option key={op.id} value={op.id}>{op.nome}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Quando definido, escalações deste fluxo vão direto para este operador em vez da fila.
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-600">Tentativa de recuperação</span>
                  <button
                    onClick={() => setAgente(a => ({ ...a, recuperacao: { ...a.recuperacao, ativo: !a.recuperacao.ativo } }))}
                    className={`w-10 h-5 rounded-full transition-colors relative ${agente.recuperacao.ativo ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${agente.recuperacao.ativo ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                {agente.recuperacao.ativo && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Horas sem resposta antes de tentar</label>
                      <input
                        type="number"
                        min={1} max={72}
                        value={agente.recuperacao.horas_espera}
                        onChange={e => setAgente(a => ({ ...a, recuperacao: { ...a.recuperacao, horas_espera: Number(e.target.value) } }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-purple-300 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Máximo de tentativas</label>
                      <input
                        type="number"
                        min={0} max={5}
                        value={agente.recuperacao.max_tentativas}
                        onChange={e => setAgente(a => ({ ...a, recuperacao: { ...a.recuperacao, max_tentativas: Number(e.target.value) } }))}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-purple-300 focus:outline-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">0 = desativar tentativas de recuperação</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong className="text-gray-700">Detecção de incômodo:</strong> sempre ativa. Se o lead pedir para parar, o agente encerra imediatamente e marca o lead como <em>opt-out</em>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Timeline principal */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-0">

            {etapas.map((etapa, index) => (
              <div key={etapa.id}>
                <EtapaCard
                  etapa={etapa}
                  index={index}
                  total={etapas.length}
                  opcoesDestino={opcoesDestino}
                  onAtualizar={(patch) => atualizarEtapa(index, patch)}
                  onMover={(dir) => moverEtapa(index, dir)}
                  onRemover={() => removerEtapa(index)}
                  fluxoId={fluxoId}
                />

                {/* Conector + botão entre etapas */}
                <div className="flex flex-col items-center py-1">
                  <div className="w-0.5 h-4 bg-gray-300" />
                  <button
                    onClick={() => adicionarEtapa(index)}
                    className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-colors text-lg leading-none flex items-center justify-center"
                    title="Adicionar etapa aqui"
                  >
                    +
                  </button>
                  {index < etapas.length - 1 && <div className="w-0.5 h-4 bg-gray-300" />}
                </div>
              </div>
            ))}

            {/* Terminadores visuais */}
            <div className="flex gap-3 justify-center mt-2">
              <span className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-medium">✅ Sucesso</span>
              <span className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-full font-medium">❌ Sem interesse</span>
              <span className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full font-medium">👤 Operador</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

// ─── EnvioItemRow — linha individual de envio ─────────────────────────────────

interface EnvioItemRowProps {
  envio: EnvioConfig
  index: number
  total: number
  fluxoId: number
  onAtualizar: (patch: Partial<EnvioConfig>) => void
  onRemover: () => void
}

function EnvioItemRow({ envio, index, total, fluxoId, onAtualizar, onRemover }: EnvioItemRowProps) {
  const [uploadando, setUploadando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const precisaMidia = ['imagem', 'video', 'audio'].includes(envio.tipo)
  const precisaTexto = ['texto', 'link_afiliado'].includes(envio.tipo)
  const ehTerminal = ['escalar', 'encerrar'].includes(envio.tipo)

  async function handleUpload(file: File) {
    setUploadando(true)
    try {
      const params = new URLSearchParams({ nome: file.name, contentType: file.type })
      const r = await fetch(`/api/fluxos/upload?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      })
      const data = await r.json()
      if (!r.ok) { alert(`Erro no upload: ${data.erro ?? r.status}`); return }
      onAtualizar({ url: data.publicUrl })
    } catch (e: unknown) {
      alert(`Erro inesperado no upload: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setUploadando(false)
    }
  }

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${index === 0 ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex items-center gap-2">
        {total > 1 && (
          <span className="text-xs text-gray-400 font-mono shrink-0">{index + 1}.</span>
        )}
        <select
          value={envio.tipo}
          onChange={e => onAtualizar({ tipo: e.target.value as TipoEnvio, url: '', conteudo: '', mensagem_pre: '' })}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-green-300 focus:outline-none"
        >
          <option value="texto">💬 Texto</option>
          <option value="imagem">🖼 Imagem</option>
          <option value="video">🎥 Vídeo</option>
          <option value="audio">🎵 Áudio</option>
          <option value="link_afiliado">🔗 Link rastreado</option>
          {total === 1 && <option value="escalar">👤 Escalar para operador</option>}
          {total === 1 && <option value="encerrar">✅ Encerrar fluxo</option>}
        </select>
        {total > 1 && (
          <button
            onClick={onRemover}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
            title="Remover este envio"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {precisaTexto && (
        <textarea
          value={envio.tipo === 'link_afiliado' ? envio.mensagem_pre : envio.conteudo}
          onChange={e => envio.tipo === 'link_afiliado'
            ? onAtualizar({ mensagem_pre: e.target.value })
            : onAtualizar({ conteudo: e.target.value })}
          rows={3}
          placeholder={envio.tipo === 'link_afiliado'
            ? 'Mensagem antes do link (ex: "Aqui está seu acesso:")'
            : 'Digite a mensagem... Use {{nome}} para variáveis'}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-green-300 focus:outline-none"
        />
      )}

      {precisaMidia && (
        <div className="space-y-2">
          {envio.url ? (
            <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
              <span className="text-xs text-gray-600 truncate flex-1">{envio.url.split('/').pop()}</span>
              <button onClick={() => onAtualizar({ url: '' })} className="text-red-400 hover:text-red-600 text-xs shrink-0">remover</button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadando}
              className="w-full border-2 border-dashed border-gray-200 rounded-lg p-3 text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploadando
                ? <><span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> Enviando...</>
                : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> Clique para fazer upload</>
              }
            </button>
          )}
          <input
            ref={fileRef} type="file"
            accept={envio.tipo === 'imagem' ? 'image/*' : envio.tipo === 'video' ? 'video/*' : 'audio/*'}
            className="hidden"
            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          {envio.url && (
            <textarea
              value={envio.conteudo}
              onChange={e => onAtualizar({ conteudo: e.target.value })}
              rows={2}
              placeholder="Legenda (opcional). Use {{nome}} para variáveis."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-green-300 focus:outline-none"
            />
          )}
        </div>
      )}

      {ehTerminal && (
        <p className="text-xs text-gray-400 italic">
          {envio.tipo === 'escalar' ? 'A conversa será transferida para um operador humano.' : 'O fluxo será encerrado como concluído.'}
        </p>
      )}
    </div>
  )
}

// ─── Card de etapa ────────────────────────────────────────────────────────────

interface EtapaCardProps {
  etapa: Etapa
  index: number
  total: number
  opcoesDestino: { id: string; label: string }[]
  onAtualizar: (patch: Partial<Etapa>) => void
  onMover: (dir: -1 | 1) => void
  onRemover: () => void
  fluxoId: number
}

function EtapaCard({ etapa, index, total, opcoesDestino, onAtualizar, onMover, onRemover, fluxoId }: EtapaCardProps) {
  const [aberta, setAberta] = useState(true)
  const [keywordInput, setKeywordInput] = useState('')

  const upEnvioAt = (idx: number, patch: Partial<EnvioConfig>) =>
    onAtualizar({ envios: etapa.envios.map((e, i) => i === idx ? { ...e, ...patch } : e) })

  const addEnvio = () =>
    onAtualizar({ envios: [...etapa.envios, envioDefault()] })

  const removeEnvio = (idx: number) =>
    onAtualizar({ envios: etapa.envios.filter((_, i) => i !== idx) })

  const upEsperar = (patch: Partial<EsperarConfig>) =>
    onAtualizar({ esperar: { ...etapa.esperar, ...patch } })

  const upNoMatch = (patch: Partial<NoMatchConfig>) =>
    onAtualizar({ se_no_match: { tipo: 'agente', agente_prompt: '', apos_recuperar: '__proximo__', apos_falhar: '__perdida__', ...etapa.se_no_match, ...patch } })

  // ehAcao: escalar/encerrar como único envio → oculta seção de espera e roteamento
  const ehAcao = etapa.envios.length === 1 && ['escalar', 'encerrar'].includes(etapa.envios[0]?.tipo ?? '')
  const podeAdicionarEnvio = !ehAcao

  // Keywords
  const addKeyword = () => {
    const k = keywordInput.trim().toLowerCase()
    if (k && !etapa.esperar.keywords.includes(k)) {
      upEsperar({ keywords: [...etapa.esperar.keywords, k] })
    }
    setKeywordInput('')
  }

  const removeKeyword = (k: string) =>
    upEsperar({ keywords: etapa.esperar.keywords.filter(x => x !== k) })

  const corBorda = index === 0 ? 'border-green-300' : 'border-gray-200'
  const corNumero = index === 0 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'

  return (
    <div className={`bg-white rounded-xl border ${corBorda} shadow-sm overflow-hidden`}>

      {/* Header do card */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setAberta(v => !v)}
      >
        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${corNumero}`}>
          {index + 1}
        </span>
        <input
          value={etapa.nome}
          onChange={e => { e.stopPropagation(); onAtualizar({ nome: e.target.value }) }}
          onClick={e => e.stopPropagation()}
          className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-none outline-none focus:bg-gray-100 rounded px-1"
          placeholder="Nome da etapa"
        />
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button disabled={index === 0} onClick={() => onMover(-1)} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <button disabled={index === total - 1} onClick={() => onMover(1)} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button disabled={total <= 1} onClick={onRemover} className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${aberta ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {aberta && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">

          {/* ── Seção: O que envio ─────────────────────────────────────────── */}
          <div className="px-4 py-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">📤 O que envio</p>

            <div className="space-y-2">
              {etapa.envios.map((envio, idx) => (
                <EnvioItemRow
                  key={idx}
                  envio={envio}
                  index={idx}
                  total={etapa.envios.length}
                  fluxoId={fluxoId}
                  onAtualizar={patch => upEnvioAt(idx, patch)}
                  onRemover={() => removeEnvio(idx)}
                />
              ))}
            </div>

            {podeAdicionarEnvio && (
              <button
                onClick={addEnvio}
                className="w-full text-xs text-green-700 border border-dashed border-green-300 bg-green-50 hover:bg-green-100 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar envio
              </button>
            )}
          </div>

          {/* ── Seção: O que espero ────────────────────────────────────────── */}
          {!ehAcao && (
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">📥 O que espero de volta</p>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={etapa.aguardar}
                    onChange={e => onAtualizar({ aguardar: e.target.checked })}
                    className="rounded"
                  />
                  Aguardar resposta
                </label>
              </div>

              {etapa.aguardar && (
                <>
                  <div className="flex gap-2">
                    <select
                      value={etapa.esperar.tipo}
                      onChange={e => upEsperar({ tipo: e.target.value as TipoEspera })}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-green-300 focus:outline-none"
                    >
                      <option value="keywords">Palavras-chave</option>
                      <option value="qualquer">Qualquer resposta</option>
                      <option value="numero">Número</option>
                    </select>
                  </div>

                  {etapa.esperar.tipo === 'keywords' && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5 min-h-8">
                        {etapa.esperar.keywords.map(k => (
                          <span key={k} className="flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {k}
                            <button onClick={() => removeKeyword(k)} className="text-green-600 hover:text-green-900 leading-none">&times;</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={keywordInput}
                          onChange={e => setKeywordInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addKeyword()}
                          placeholder="sim, quero, claro... (Enter para adicionar)"
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-green-300 focus:outline-none"
                        />
                        <button onClick={addKeyword} className="text-xs text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg">
                          + Add
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Contexto para a IA avaliar (quando keywords não batem)</label>
                    <input
                      value={etapa.esperar.descricao}
                      onChange={e => upEsperar({ descricao: e.target.value })}
                      placeholder="Ex: Lead confirmou interesse em investir"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-green-300 focus:outline-none"
                    />
                  </div>

                  {etapa.esperar.tipo === 'qualquer' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Salvar resposta como variável (opcional)</label>
                      <input
                        value={etapa.esperar.salvar_como}
                        onChange={e => upEsperar({ salvar_como: e.target.value })}
                        placeholder="Ex: nome, email, cidade"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-green-300 focus:outline-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">Após isso, use {'{{nome}}'} nas mensagens seguintes</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Seção: Roteamento ──────────────────────────────────────────── */}
          {!ehAcao && (
            <div className="px-4 py-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🔀 Roteamento</p>

              {/* Match */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded shrink-0">✅ Certo</span>
                <select
                  value={etapa.se_match}
                  onChange={e => onAtualizar({ se_match: e.target.value })}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-green-300 focus:outline-none"
                >
                  {opcoesDestino.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* No-match */}
              {etapa.aguardar && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded shrink-0">❌ Errado</span>
                    <select
                      value={etapa.se_no_match?.tipo ?? 'nenhum'}
                      onChange={e => {
                        const v = e.target.value
                        if (v === 'nenhum') onAtualizar({ se_no_match: null })
                        else upNoMatch({ tipo: v as TipoNoMatch })
                      }}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-green-300 focus:outline-none"
                    >
                      <option value="nenhum">Aguardar próxima mensagem</option>
                      <option value="agente">🤖 Convocar Agente IA</option>
                      <option value="aguardar">⏰ Aguardar recuperação automática</option>
                      <option value="encerrar">❌ Encerrar (sem interesse)</option>
                      <option value="escalar">👤 Escalar para operador</option>
                    </select>
                  </div>

                  {etapa.se_no_match?.tipo === 'agente' && (
                    <div className="ml-20 space-y-2">
                      <textarea
                        value={etapa.se_no_match.agente_prompt}
                        onChange={e => upNoMatch({ agente_prompt: e.target.value })}
                        rows={2}
                        placeholder="Instrução específica para o agente nessa etapa. Ex: 'O lead desviou. Entenda a objeção e redirecione para a pergunta anterior.'"
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:ring-2 focus:ring-purple-300 focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 shrink-0">Se recuperar →</span>
                        <select
                          value={etapa.se_no_match.apos_recuperar}
                          onChange={e => upNoMatch({ apos_recuperar: e.target.value })}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                        >
                          {opcoesDestino.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 shrink-0">Se falhar →</span>
                        <select
                          value={etapa.se_no_match.apos_falhar}
                          onChange={e => upNoMatch({ apos_falhar: e.target.value })}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                        >
                          {opcoesDestino.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
