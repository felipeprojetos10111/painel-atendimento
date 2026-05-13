'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import ModalRespostasRapidas from './ModalRespostasRapidas'
import AvatarOperador from './AvatarOperador'
import { useLingua } from '@/contexts/LinguaContext'

interface Mensagem {
  id: number
  conteudo: string
  origem: string
  tipo: string | null
  url_midia: string | null
  status: string | null
  enviado_em: string | null
}

interface RespostaRapida {
  id: number
  titulo: string
  tipo: string
  conteudo: string | null
  url_midia: string | null
  categoria: string | null
  atalho: string | null
}

interface Operador {
  id: number
  nome: string
  nivel: string | null
  ativo: boolean | null
}

interface Me {
  id: number
  nome: string
  nivel: string
}

interface Props {
  conversaId: number
  onUploadChange?: (emAndamento: boolean) => void
}

const ORIGEM_ESTILO: Record<string, { alinhamento: string; bolha: string }> = {
  lead:     { alinhamento: 'items-start', bolha: 'bg-[#202c33] text-[#e9edef]' },
  ia:       { alinhamento: 'items-end',   bolha: 'bg-[#1a3a4a] text-[#e9edef] border border-[#2a5a72]/50' },
  operador: { alinhamento: 'items-end',   bolha: 'bg-[#005c4b] text-[#e9edef]' },
}

const ORIGEM_CHAVE: Record<string, string> = {
  lead:     'origemLead',
  ia:       'origemIA',
  operador: 'origemVoce',
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

function tocarSom() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.25)
    osc.onended = () => ctx.close()
  } catch {
    // bloqueado sem interação do usuário
  }
}

// Botão para enviar link de registro para o lead (com modal de edição)
function BotaoEnviarLink({ conversaId, ocupado }: { conversaId: number; ocupado: boolean }) {
  const { tr } = useLingua()
  const [modalAberto, setModalAberto] = useState(false)
  const [mensagem, setMensagem]       = useState('')
  const [linkInfo, setLinkInfo]       = useState<{ link_completo: string; mensagem_link: string } | null>(null)
  const [carregando, setCarregando]   = useState(false)
  const [enviando, setEnviando]       = useState(false)
  const [feedback, setFeedback]       = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  async function abrirModal() {
    setModalAberto(true)
    setFeedback(null)
    setCarregando(true)
    try {
      const res = await fetch('/api/operadores/meu-link')
      if (res.ok) {
        const data = await res.json()
        setLinkInfo(data)
        // Pré-preenche com a mensagem padrão configurada pelo operador
        setMensagem(data.mensagem_link ?? '')
      }
    } finally {
      setCarregando(false)
    }
  }

  function fecharModal() {
    if (enviando) return
    setModalAberto(false)
    setMensagem('')
    setLinkInfo(null)
    setFeedback(null)
  }

  async function confirmarEnvio() {
    setEnviando(true); setFeedback(null)
    try {
      const res = await fetch('/api/chat/enviar-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversa_id: conversaId, mensagem_prefixo: mensagem.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback({ tipo: 'erro', msg: data.erro ?? 'Erro ao enviar link.' })
      } else {
        setFeedback({ tipo: 'ok', msg: 'Link enviado com sucesso!' })
        setTimeout(() => fecharModal(), 1500)
      }
    } catch {
      setFeedback({ tipo: 'erro', msg: tr('enviarLinkErroConexao') })
    } finally {
      setEnviando(false)
    }
  }

  // Preview do que será enviado
  const preview = linkInfo?.link_completo
    ? (mensagem.trim() ? `${mensagem.trim()}\n\n${linkInfo.link_completo}` : linkInfo.link_completo)
    : ''

  return (
    <>
      <button
        type="button"
        disabled={ocupado}
        onClick={abrirModal}
        className="flex items-center gap-1.5 text-xs font-medium text-[#8696a0] hover:text-[#00a884] hover:bg-green-900/20 px-3 py-1.5 rounded-lg border border-[#2a3942] hover:border-[#00a884] transition-colors disabled:opacity-50"
        title={tr('enviarLinkTitulo')}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        {tr('enviarLinkTitulo')}
      </button>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-[#202c33] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#e9edef]">{tr('enviarLinkTitulo')}</h3>
              <button onClick={fecharModal} className="text-[#8696a0] hover:text-[#e9edef] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {carregando ? (
              <div className="flex justify-center py-6">
                <span className="w-6 h-6 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-[#8696a0] mb-1">
                    {tr('enviarLinkMsgLabel')}
                    <span className="text-[#3b4a54] font-normal ml-1">{tr('enviarLinkMsgOpcional')}</span>
                  </label>
                  <textarea
                    value={mensagem}
                    onChange={e => setMensagem(e.target.value)}
                    rows={3}
                    placeholder={tr('enviarLinkMsgPlaceholder')}
                    className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-3 py-2 text-sm text-[#e9edef] focus:outline-none focus:ring-2 focus:ring-[#00a884] resize-none"
                  />
                  {mensagem.trim() && (
                    <button
                      type="button"
                      onClick={() => setMensagem('')}
                      className="text-xs text-[#3b4a54] hover:text-[#8696a0] mt-1"
                    >
                      {tr('enviarLinkLimpar')}
                    </button>
                  )}
                </div>

                {/* Preview */}
                {linkInfo?.link_completo && (
                  <div>
                    <p className="text-xs font-medium text-[#8696a0] mb-1">{tr('enviarLinkPrevia')}</p>
                    <div className="bg-green-900/20 border border-green-800/30 rounded-xl px-4 py-3 text-sm text-[#e9edef] whitespace-pre-wrap break-all">
                      {preview}
                    </div>
                  </div>
                )}

                {!linkInfo?.link_completo && (
                  <p className="text-sm text-amber-400 bg-amber-900/20 rounded-lg px-3 py-2">
                    {tr('enviarLinkSemUrl')}
                  </p>
                )}

                {feedback && (
                  <p className={`text-sm font-medium ${feedback.tipo === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
                    {feedback.msg}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={fecharModal}
                    disabled={enviando}
                    className="flex-1 border border-[#2a3942] text-[#8696a0] text-sm font-medium py-2 rounded-lg hover:bg-[#111b21] transition-colors disabled:opacity-50"
                  >
                    {tr('cancelar')}
                  </button>
                  <button
                    onClick={confirmarEnvio}
                    disabled={enviando || !linkInfo?.link_completo}
                    className="flex-1 bg-[#00a884] hover:bg-[#017561] disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {enviando && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {enviando ? tr('enviarLinkEnviando') : tr('enviar')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// Ícone de status para mensagens do operador
function StatusMensagem({ status, onReenviar }: { status: string | null; onReenviar?: () => void }) {
  if (!status) return null

  if (status === 'enviando') return (
    <span className="inline-flex items-center gap-1 ml-1 text-white/60 text-xs">
      <span className="w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
      Enviando...
    </span>
  )

  if (status === 'enviado') return (
    <span className="inline-flex items-center gap-1 ml-1 text-white/70 text-xs">
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
        <path d="M13.5 3.5L6 11 2.5 7.5l-1 1L6 13l8.5-8.5z"/>
      </svg>
      Enviada
    </span>
  )

  if (status === 'entregue') return (
    <span className="inline-flex items-center gap-1 ml-1 text-white/70 text-xs">
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 16" fill="currentColor">
        <path d="M18 3.5L10.5 11 7 7.5l-1 1 4.5 4.5L19 4.5zM13 3.5L5.5 11 2 7.5l-1 1L5.5 13 14 4.5z"/>
      </svg>
      Recebida
    </span>
  )

  if (status === 'lido') return (
    <span className="inline-flex items-center gap-1 ml-1 text-white text-xs font-bold">
      <svg className="w-4 h-4 shrink-0 drop-shadow" viewBox="0 0 20 16" fill="currentColor">
        <path d="M18 3.5L10.5 11 7 7.5l-1 1 4.5 4.5L19 4.5zM13 3.5L5.5 11 2 7.5l-1 1L5.5 13 14 4.5z"/>
      </svg>
      Lida
    </span>
  )

  if (status === 'erro') return (
    <span className="inline-flex items-center gap-1.5 ml-1">
      <span className="text-xs text-red-300 font-medium">Erro ao enviar</span>
      <button
        onClick={onReenviar}
        className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-500/80 hover:bg-red-500 px-2 py-0.5 rounded-full transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Reenviar
      </button>
    </span>
  )

  return null
}

// Renderiza o conteúdo da mensagem (texto, imagem, documento, áudio, vídeo)
function ConteudoMensagem({ msg }: { msg: Mensagem }) {
  const isOperador = msg.origem === 'operador'

  if (msg.tipo === 'imagem' && msg.url_midia) {
    return (
      <div className="space-y-1">
        <a href={msg.url_midia} target="_blank" rel="noopener noreferrer">
          <img
            src={msg.url_midia}
            alt={msg.conteudo}
            className="max-w-[220px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onError={e => {
              const parent = (e.target as HTMLElement).parentElement
              if (parent) parent.innerHTML = `<span class="text-sm underline">📎 ${msg.conteudo}</span>`
            }}
          />
        </a>
        {msg.conteudo && msg.conteudo !== msg.url_midia && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.conteudo}</p>
        )}
      </div>
    )
  }

  if (msg.tipo === 'video' && msg.url_midia) {
    return (
      <div className="space-y-1">
        <video controls src={msg.url_midia} className="max-w-[260px] rounded-lg" />
        {msg.conteudo && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.conteudo}</p>
        )}
      </div>
    )
  }

  if (msg.tipo === 'audio' && msg.url_midia) {
    return <audio controls src={msg.url_midia} className="max-w-[240px]" />
  }

  if (msg.tipo === 'documento' && msg.url_midia) {
    return (
      <a
        href={msg.url_midia}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 text-sm underline underline-offset-2 ${isOperador ? 'text-white' : 'text-blue-700'}`}
      >
        <span className="text-lg">📄</span>
        <span className="truncate max-w-[180px]">{msg.conteudo}</span>
      </a>
    )
  }

  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.conteudo}</p>
}

let socket: Socket | null = null

export default function Chat({ conversaId, onUploadChange }: Props) {
  const { tr } = useLingua()
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviandoArquivo, setEnviandoArquivo] = useState(false)
  const [erroUpload, setErroUpload] = useState('')
  const [arquivoPreview, setArquivoPreview] = useState<{ file: File; previewUrl: string | null; tipo: string } | null>(null)
  const [gravando, setGravando] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [tempoGravacao, setTempoGravacao] = useState(0)
  const [status, setStatus] = useState('')
  const [operadorNome, setOperadorNome] = useState<string | null>(null)
  const [leadNome, setLeadNome] = useState<string | null>(null)
  const [leadTelefone, setLeadTelefone] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [transferindo, setTransferindo] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [barras, setBarras] = useState<number[]>(Array(28).fill(0))
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number | null>(null)

  function ajustarAltura() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start(100)
      mediaRecorderRef.current = recorder
      setGravando(true)
      setTempoGravacao(0)
      timerRef.current = setInterval(() => setTempoGravacao(t => t + 1), 1000)

      // Visualizador de ondas via Web Audio API
      try {
        const audioCtx = new AudioContext()
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 64
        audioCtx.createMediaStreamSource(stream).connect(analyser)
        analyserRef.current = analyser
        audioCtxRef.current = audioCtx
        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(data)
          const n = 28
          setBarras(Array.from({ length: n }, (_, i) => {
            const idx = Math.floor(i * data.length / n)
            return data[idx] / 255
          }))
          animFrameRef.current = requestAnimationFrame(tick)
        }
        animFrameRef.current = requestAnimationFrame(tick)
      } catch { /* browser sem suporte — sem visualizador */ }
    } catch {
      alert('Permissão de microfone negada.')
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop()
    setGravando(false)
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    analyserRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setBarras(Array(28).fill(0))
  }

  function descartarAudio() {
    setAudioBlob(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setTempoGravacao(0)
  }

  async function enviarAudio() {
    if (!audioBlob) return
    setErroUpload('')
    setEnviandoArquivo(true)
    try {
      const params = new URLSearchParams({ nome: 'audio.webm', contentType: 'audio/webm' })
      const uploadRes = await fetch(`/api/chat/upload?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: audioBlob
      })
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        throw new Error(err.erro ?? `Erro ${uploadRes.status} ao fazer upload do áudio`)
      }
      const { urlPublica } = await uploadRes.json()

      await enviarConteudo('Áudio', 'audio', urlPublica)
      descartarAudio()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido no upload'
      console.error('[audio upload]', msg)
      setErroUpload(msg)
    } finally {
      setEnviandoArquivo(false)
    }
  }

  function formatarTempo(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const seg = (s % 60).toString().padStart(2, '0')
    return `${m}:${seg}`
  }

  async function carregarMensagens() {
    const res = await fetch(`/api/conversas/${conversaId}/mensagens`)
    const data = await res.json()
    setMensagens(data)
  }

  async function carregarStatus() {
    const res = await fetch('/api/conversas')
    const lista = await res.json()
    const conversa = lista.find((c: {
      id: number
      status: string
      operadores?: { nome: string } | null
      leads?: { nome: string | null; telefone: string } | null
    }) => c.id === conversaId)
    if (conversa) {
      setStatus(conversa.status ?? '')
      setOperadorNome(conversa.operadores?.nome ?? null)
      setLeadNome(conversa.leads?.nome ?? null)
      setLeadTelefone(conversa.leads?.telefone ?? null)
    }
  }

  async function zerarNaoLidas() {
    await fetch(`/api/conversas/${conversaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nao_lidas: 0 })
    })
  }

  useEffect(() => {
    carregarMensagens()
    carregarStatus()
    zerarNaoLidas()

    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then((data: Me | null) => {
        if (!data) return
        setMe(data)
        if (data.nivel === 'supervisor') {
          fetch('/api/operadores')
            .then(r => r.json())
            .then((ops: Operador[]) =>
              setOperadores(ops.filter(o => o.nivel === 'operador' && o.ativo))
            )
        }
      })

    if (!socket) {
      socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!)
    }

    socket.emit('join-conversa', conversaId)

    socket.on('nova-mensagem', (msg: Mensagem) => {
      if (msg.origem === 'lead' || msg.origem === 'ia') tocarSom()
      setMensagens(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })

    socket.on('status-alterado', (data: { conversaId: number; status: string }) => {
      if (data.conversaId === conversaId) {
        setStatus(data.status)
        carregarStatus() // atualiza operador vinculado também
      }
    })

    socket.on('status-mensagem', (data: { mensagemId: number; status: string }) => {
      setMensagens(prev => prev.map(m =>
        m.id === data.mensagemId ? { ...m, status: data.status } : m
      ))
    })

    return () => {
      socket?.emit('leave-conversa', conversaId)
      socket?.off('nova-mensagem')
      socket?.off('status-alterado')
      socket?.off('status-mensagem')
      if (timerRef.current) clearInterval(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  useEffect(() => {
    onUploadChange?.(enviandoArquivo)
  }, [enviandoArquivo, onUploadChange])

  async function reenviarMensagem(mensagemId: number) {
    await fetch(`/api/mensagens/${mensagemId}/reenviar`, { method: 'POST' })
  }

  async function enviarConteudo(conteudo: string, tipo = 'texto', url_midia?: string) {
    if (tipo === 'texto' && !conteudo.trim()) return
    if (enviando) return
    setEnviando(true)

    const body: Record<string, string> = { conteudo, tipo }
    if (url_midia) body.url_midia = url_midia

    const res = await fetch(`/api/conversas/${conversaId}/mensagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (res.ok) {
      const nova = await res.json()
      setMensagens(prev => {
        if (prev.some(m => m.id === nova.id)) return prev
        return [...prev, nova]
      })
    }

    setEnviando(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    const conteudo = texto
    setTexto('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    await enviarConteudo(conteudo)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sozinho envia; Shift+Enter quebra linha
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    setErroUpload('')
    setEnviandoArquivo(true)

    try {
      // Detecta tipo — fallback por extensão
      const EXT_MIME: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif',  webp: 'image/webp', mp3: 'audio/mpeg',
        ogg: 'audio/ogg',  wav: 'audio/wav',   mp4: 'video/mp4',
        webm: 'video/webm', pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
      const ext = arquivo.name.split('.').pop()?.toLowerCase() ?? ''
      const contentType = arquivo.type || EXT_MIME[ext] || ''
      if (!contentType) throw new Error(`Tipo não suportado: .${ext}`)

      const TIPOS: Record<string, string> = {
        'image/jpeg': 'imagem', 'image/png': 'imagem', 'image/webp': 'imagem', 'image/gif': 'imagem',
        'audio/mpeg': 'audio',  'audio/ogg': 'audio',  'audio/wav': 'audio', 'audio/webm': 'audio',
        'video/mp4': 'video',   'video/webm': 'video',  'video/quicktime': 'video', 'video/x-msvideo': 'video',
        'application/pdf': 'documento', 'application/msword': 'documento',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documento',
      }
      // Suporte genérico a video/* e audio/* não mapeados explicitamente
      let tipo = TIPOS[contentType]
      if (!tipo && contentType.startsWith('video/')) tipo = 'video'
      if (!tipo && contentType.startsWith('audio/')) tipo = 'audio'
      if (!tipo) throw new Error(`Tipo não permitido: ${contentType}`)

      // Valida tamanho máximo (limites do WhatsApp)
      const LIMITE_MB: Record<string, number> = { imagem: 5, audio: 16, video: 16, documento: 100 }
      const limiteMB = LIMITE_MB[tipo] ?? 16
      if (arquivo.size > limiteMB * 1024 * 1024) {
        throw new Error(`Arquivo muito grande. Limite: ${limiteMB}MB para ${tipo}.`)
      }

      // Gera preview local e aguarda confirmação do usuário
      const previewUrl = tipo === 'imagem' ? URL.createObjectURL(arquivo) : null
      setArquivoPreview({ file: arquivo, previewUrl, tipo })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido no upload'
      console.error('[upload]', msg)
      setErroUpload(msg)
    } finally {
      setEnviandoArquivo(false)
      e.target.value = ''
    }
  }

  async function confirmarEnvioArquivo() {
    if (!arquivoPreview) return
    const { file, previewUrl, tipo } = arquivoPreview
    setArquivoPreview(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setErroUpload('')
    setEnviandoArquivo(true)
    try {
      const contentType = file.type || ''
      const params = new URLSearchParams({ nome: file.name, contentType })
      const uploadRes = await fetch(`/api/chat/upload?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file
      })
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        throw new Error(err.erro ?? `Erro ${uploadRes.status} ao fazer upload`)
      }
      const { urlPublica } = await uploadRes.json()
      // Não passa o nome do arquivo como caption — documentos usam o nome, mídia fica sem legenda
      const caption = tipo === 'documento' ? file.name : ''
      await enviarConteudo(caption, tipo, urlPublica)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro no upload'
      setErroUpload(msg)
    } finally {
      setEnviandoArquivo(false)
    }
  }

  function cancelarArquivo() {
    if (arquivoPreview?.previewUrl) URL.revokeObjectURL(arquivoPreview.previewUrl)
    setArquivoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSelecionarResposta(resposta: RespostaRapida) {
    setModalAberto(false)
    if (resposta.url_midia) {
      await enviarConteudo(resposta.conteudo ?? '', resposta.tipo, resposta.url_midia)
    } else {
      const conteudo = resposta.conteudo ?? ''
      if (!conteudo) return
      await enviarConteudo(conteudo)
    }
    textareaRef.current?.focus()
  }

  async function encerrar() {
    if (!confirm(tr('confirmarEncerrar'))) return
    setEncerrando(true)
    await fetch(`/api/conversas/${conversaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolvida' })
    })
    setStatus('resolvida')
    setEncerrando(false)
  }

  async function transferir(novoOperadorId: number) {
    const op = operadores.find(o => o.id === novoOperadorId)
    if (!op) return
    if (!confirm(`${tr('confirmarTransferencia')} ${op.nome}?`)) return
    setTransferindo(false)
    await fetch(`/api/conversas/${conversaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operador_id: novoOperadorId, status: 'em_atendimento' })
    })
  }

  const resolvida = status === 'resolvida'
  const statusCor = STATUS_COR[status] ?? 'bg-gray-100 text-gray-600'
  const statusLabel = STATUS_CHAVE[status] ? tr(STATUS_CHAVE[status]) : status
  const ocupado = enviando || enviandoArquivo

  return (
    <div className="flex flex-col flex-1 bg-[#111b21]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#1f2c33] border-b border-[#2a3942]">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar do lead com iniciais ou ícone de telefone */}
          <div className="w-9 h-9 rounded-full bg-[#202c33] flex items-center justify-center shrink-0 text-[#8696a0] font-semibold text-sm select-none">
            {leadNome
              ? leadNome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            }
          </div>

          {/* Nome e telefone do lead */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#e9edef] leading-tight truncate">
                {leadNome ?? leadTelefone ?? `${tr('conversa')} #${conversaId}`}
              </p>
              <span className="text-[10px] font-mono text-[#3b4a54] bg-[#202c33] px-1.5 py-0.5 rounded shrink-0">
                #{conversaId}
              </span>
            </div>
            {leadNome && leadTelefone && (
              <p className="text-xs text-[#8696a0] leading-tight font-mono">{leadTelefone}</p>
            )}
          </div>

          {/* Operador responsável */}
          {operadorNome && (
            <div className="flex items-center gap-1.5 bg-[#202c33] border border-[#2a3942] rounded-full pl-1 pr-2.5 py-0.5 shrink-0">
              <AvatarOperador nome={operadorNome} tamanho="xs" destaque />
              <span className="text-xs text-[#8696a0] font-medium">{operadorNome.split(' ')[0]}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusCor}`}>
            {statusLabel}
          </span>

          {me?.nivel === 'supervisor' && !resolvida && (
            transferindo ? (
              <div className="flex items-center gap-1">
                <select
                  autoFocus
                  defaultValue=""
                  onChange={e => e.target.value && transferir(Number(e.target.value))}
                  className="text-xs text-[#e9edef] bg-[#202c33] border border-[#2a3942] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>{tr('selecionarOperador')}</option>
                  {operadores.map(op => (
                    <option key={op.id} value={op.id}>{op.nome}</option>
                  ))}
                </select>
                <button onClick={() => setTransferindo(false)} className="text-[#8696a0] hover:text-[#e9edef] p-1 rounded">✕</button>
              </div>
            ) : (
              <button
                onClick={() => setTransferindo(true)}
                className="text-xs text-blue-400 border border-blue-800/40 hover:bg-blue-900/20 px-2.5 py-1 rounded-lg transition-colors"
              >
                {tr('transferirConversa')}
              </button>
            )
          )}

          {!resolvida && (
            <button
              onClick={encerrar}
              disabled={encerrando}
              className="text-xs text-red-400 border border-red-800/40 hover:bg-red-900/20 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              {tr('encerrarConversa')}
            </button>
          )}
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {mensagens.map(m => {
          const estilo = ORIGEM_ESTILO[m.origem] ?? ORIGEM_ESTILO.lead
          const label = ORIGEM_CHAVE[m.origem] ? tr(ORIGEM_CHAVE[m.origem]) : m.origem
          return (
            <div key={m.id} className={`flex flex-col gap-1 ${estilo.alinhamento}`}>
              <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm ${estilo.bolha}`}>
                <ConteudoMensagem msg={m} />
                {m.origem === 'operador' && (
                  <div className="flex justify-end items-center mt-1">
                    <StatusMensagem
                      status={m.status}
                      onReenviar={() => reenviarMensagem(m.id)}
                    />
                  </div>
                )}
              </div>
              <span className="text-xs text-[#3b4a54]">
                {label} · {m.enviado_em
                  ? new Date(m.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : ''}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input ou banner de encerrada */}
      {resolvida ? (
        <div className="bg-[#1f2c33] border-t border-[#2a3942] px-6 py-4 flex items-center justify-center gap-2 text-sm text-[#3b4a54]">
          <span>✓</span>
          <span>{tr('conversaEncerrada')}</span>
        </div>
      ) : (
        <div className="bg-[#1f2c33] border-t border-[#2a3942] px-4 py-3">
          {/* Barra de ferramentas */}
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#8696a0] hover:text-[#00a884] hover:bg-green-900/20 px-3 py-1.5 rounded-lg border border-[#2a3942] hover:border-[#00a884] transition-colors"
            >
              <span>⚡</span>
              {tr('respostasRapidas')}
            </button>

            {/* Botão de anexo */}
            <button
              type="button"
              disabled={ocupado}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-medium text-[#8696a0] hover:text-blue-400 hover:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-[#2a3942] hover:border-blue-700 transition-colors disabled:opacity-50"
              title={tr('anexarArquivo')}
            >
              {enviandoArquivo
                ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
              }
              {tr('anexarArquivo')}
            </button>

            {/* Botão enviar link de registro */}
            {!gravando && !audioBlob && (
              <BotaoEnviarLink conversaId={conversaId} ocupado={ocupado} />
            )}

            {/* Botão gravar voz */}
            {!gravando && !audioBlob && (
              <button
                type="button"
                disabled={ocupado}
                onClick={iniciarGravacao}
                className="flex items-center gap-1.5 text-xs font-medium text-[#8696a0] hover:text-red-400 hover:bg-red-900/20 px-3 py-1.5 rounded-lg border border-[#2a3942] hover:border-red-700 transition-colors disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 17.93V21H9v2h6v-2h-2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 6.93z"/>
                </svg>
                {tr('gravarAudio')}
              </button>
            )}

            {/* Input de arquivo oculto */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx,audio/*"
              onChange={handleArquivo}
              className="hidden"
            />
          </div>

          {/* Erro de upload */}
          {erroUpload && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-red-900/20 border border-red-800/40 rounded-xl text-sm text-red-400">
              <span>⚠</span>
              <span className="flex-1">{erroUpload}</span>
              <button onClick={() => setErroUpload('')} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {/* Preview de arquivo antes de enviar */}
          {arquivoPreview && (
            <div className="mb-2 p-3 bg-[#202c33] border border-[#2a3942] rounded-xl space-y-2">
              {arquivoPreview.previewUrl ? (
                <img
                  src={arquivoPreview.previewUrl}
                  alt={arquivoPreview.file.name}
                  className="max-h-40 rounded-lg object-contain mx-auto block"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-[#e9edef]">
                  <span className="text-xl">📄</span>
                  <span className="truncate">{arquivoPreview.file.name}</span>
                  <span className="text-xs text-[#3b4a54] shrink-0">
                    {(arquivoPreview.file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={cancelarArquivo}
                  className="text-xs text-[#8696a0] hover:text-red-400 border border-[#2a3942] hover:border-red-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {tr('descartarAudio')}
                </button>
                <button
                  type="button"
                  onClick={confirmarEnvioArquivo}
                  disabled={enviandoArquivo}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#00a884] hover:bg-[#017561] disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {enviandoArquivo
                    ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                      </svg>
                  }
                  {tr('enviar')}
                </button>
              </div>
            </div>
          )}

          {/* Painel de gravação ativo */}
          {gravando && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-red-900/20 border border-red-800/40 rounded-xl">
              {/* Indicador gravando */}
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />

              {/* Tempo */}
              <span className="text-sm font-mono text-red-400 tabular-nums shrink-0">
                {formatarTempo(tempoGravacao)}
              </span>

              {/* Barras de onda em tempo real */}
              <div className="flex-1 flex items-center gap-px h-8 overflow-hidden">
                {barras.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full bg-red-500 transition-none"
                    style={{ height: `${Math.max(15, h * 100)}%` }}
                  />
                ))}
              </div>

              {/* Parar */}
              <button
                type="button"
                onClick={pararGravacao}
                className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1"/>
                </svg>
                Parar
              </button>
            </div>
          )}

          {/* Preview do áudio gravado */}
          {audioBlob && audioUrl && !gravando && (
            <div className="flex items-center gap-3 mb-2 px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-xl">
              <svg className="w-4 h-4 text-[#8696a0] shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
                <path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22H9v2h6v-2h-2v-2.06A9 9 0 0 0 21 11h-2z"/>
              </svg>
              <audio controls src={audioUrl} className="flex-1 h-8" style={{ minWidth: 0 }} />
              <span className="text-xs text-[#3b4a54] shrink-0">{formatarTempo(tempoGravacao)}</span>
              <button
                type="button"
                onClick={descartarAudio}
                className="text-[#8696a0] hover:text-red-400 transition-colors shrink-0"
                title={tr('descartarAudio')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={enviarAudio}
                disabled={enviandoArquivo}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#00a884] hover:bg-[#017561] disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors shrink-0"
              >
                {enviandoArquivo
                  ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                    </svg>
                }
                {tr('enviarAudio')}
              </button>
            </div>
          )}

          {/* Textarea + enviar */}
          <form onSubmit={handleSubmit} className={`flex items-end gap-3 ${gravando || audioBlob ? 'opacity-40 pointer-events-none' : ''}`}>
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={e => { setTexto(e.target.value); ajustarAltura() }}
              onKeyDown={handleKeyDown}
              placeholder={tr('digiteMensagem')}
              rows={1}
              className="flex-1 border border-[#2a3942] rounded-2xl px-4 py-2.5 text-sm text-[#e9edef] bg-[#202c33] focus:outline-none focus:ring-2 focus:ring-[#00a884] resize-none leading-relaxed"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={ocupado || !texto.trim()}
              className="bg-[#00a884] hover:bg-[#017561] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors shrink-0"
            >
              {enviando
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                : tr('enviar')
              }
            </button>
          </form>
          <p className="text-xs text-[#3b4a54] mt-1.5 ml-1">{tr('dicaEnvio')}</p>
        </div>
      )}

      {modalAberto && (
        <ModalRespostasRapidas
          onSelecionar={handleSelecionarResposta}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </div>
  )
}
