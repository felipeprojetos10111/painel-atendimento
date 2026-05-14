'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ListaConversas from '@/components/ListaConversas'
import Chat from '@/components/Chat'
import SeletorLingua from '@/components/SeletorLingua'
import PopupStandby from '@/components/PopupStandby'
import MinhasMetricas from '@/components/MinhasMetricas'
import { useLingua } from '@/contexts/LinguaContext'
import { usePresenca } from '@/hooks/usePresenca'

export default function PainelPage() {
  const router = useRouter()
  const { tr } = useLingua()
  const [conversaSelecionada, setConversaSelecionada] = useState<number | null>(null)
  const [nivel, setNivel] = useState<string | null>(null)
  const [nomeCliente, setNomeCliente] = useState<string | null>(null)
  const [logoCliente, setLogoCliente] = useState<string | null>(null)
  const [uploadEmAndamento, setUploadEmAndamento] = useState(false)
  const [operadorNome, setOperadorNome] = useState<string | null>(null)
  const [operadorAtivo, setOperadorAtivo] = useState(false)
  const [operadorId, setOperadorId] = useState<number | null>(null)
  const [naFila, setNaFila] = useState(true)
  const [togglingFila, setTogglingFila] = useState(false)
  const [mostrarMetricas, setMostrarMetricas] = useState(false)
  const [impersonandoOperador, setImpersonandoOperador] = useState(false)

  // Presença: só ativa para operadores reais (não super_admin)
  const { emStandby, voltarAtivo } = usePresenca(operadorAtivo)

  function selecionarConversa(id: number) {
    if (uploadEmAndamento) {
      if (!confirm('Há um arquivo sendo enviado. Trocar de conversa vai cancelar o envio. Continuar?')) return
    }
    setConversaSelecionada(id)
    setMostrarMetricas(false)
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setNivel(data.nivel)
          setNomeCliente(data.nomeCliente ?? null)
          setLogoCliente(data.logoCliente ?? null)
          setOperadorNome(data.nome ?? null)
          setImpersonandoOperador(data.impersonandoOperador ?? false)
          if (data.id > 0 && data.cliente_id) {
            setOperadorAtivo(true)
            setOperadorId(data.id)
            // Carrega estado na_fila apenas para operadores reais (não supervisores)
            if (data.nivel === 'operador') {
              fetch('/api/fila/disponibilidade')
                .then(r => r.ok ? r.json() : null)
                .then(d => { if (d) setNaFila(d.na_fila) })
            }
          }
        }
      })
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  async function toggleNaFila() {
    if (!operadorId || togglingFila) return
    setTogglingFila(true)
    try {
      const res = await fetch('/api/fila/disponibilidade', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ na_fila: !naFila })
      })
      if (res.ok) {
        const d = await res.json()
        setNaFila(d.na_fila)
      }
    } finally {
      setTogglingFila(false)
    }
  }

  // O que mostrar na área principal
  const areaConteudo = mostrarMetricas || !conversaSelecionada

  return (
    <div className="flex flex-col h-screen">
      {/* Popup de stand by */}
      {emStandby && operadorNome && (
        <PopupStandby nome={operadorNome} onContinuar={voltarAtivo} />
      )}

      {/* Topbar */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#111b21] text-white shadow-md z-10">
        <div className="flex items-center gap-3">
          {/* Avatar: logo do cliente ou iniciais */}
          <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-[#00a884] text-white text-sm font-bold">
            {logoCliente ? (
              <img src={logoCliente} alt={nomeCliente ?? ''} className="w-full h-full object-cover" />
            ) : (
              <span>{nomeCliente?.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() ?? 'P'}</span>
            )}
          </div>

          {/* Título + info do cliente */}
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-[#e9edef] text-base">{tr('painelTitulo')}</span>
            {nomeCliente && (
              <span className="text-xs text-[#8696a0] flex items-center gap-1">
                <span className="text-[#00a884]">●</span>
                {nomeCliente}
              </span>
            )}
          </div>

          {/* Botão Métricas */}
          <button
            onClick={() => { setMostrarMetricas(true); setConversaSelecionada(null) }}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors border ${
              mostrarMetricas && !conversaSelecionada
                ? 'bg-[#00a884] text-white border-[#00a884] font-semibold'
                : 'border-[#2a3942] text-[#8696a0] hover:bg-[#202c33]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {tr('metricasBotao')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <SeletorLingua variante="topbar" />

          {/* Toggle na_fila — visível apenas para operadores (não supervisores) */}
          {nivel === 'operador' && (
            <button
              onClick={toggleNaFila}
              disabled={togglingFila}
              title={naFila ? 'Você está na fila — clique para sair' : 'Você está fora da fila — clique para entrar'}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors border font-medium disabled:opacity-50 ${
                naFila
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                  : 'bg-[#202c33] text-orange-400 border-orange-500 hover:bg-[#2a3942]'
              }`}
            >
              {togglingFila ? (
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>{naFila ? '📥' : '⏸'}</span>
              )}
              <span className="hidden sm:inline">{naFila ? 'Na fila' : 'Fora da fila'}</span>
            </button>
          )}

          <button
            onClick={() => router.push('/minhas-respostas')}
            className="text-sm bg-[#202c33] hover:bg-[#2a3942] px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            title="Minhas respostas rápidas"
          >
            <span>⚡</span>
            <span className="hidden sm:inline">{tr('respostasBotao')}</span>
          </button>

          {nivel === 'supervisor' && (
            <button
              onClick={() => router.push('/admin')}
              className="text-sm bg-[#202c33] hover:bg-[#2a3942] px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {tr('administracao')}
            </button>
          )}

          {/* Voltar ao Admin — apenas quando supervisor entrou como operador */}
          {impersonandoOperador && (
            <button
              onClick={async () => {
                await fetch('/api/admin/sair-impersonar-operador', { method: 'POST' })
                window.location.href = '/admin'
              }}
              className="text-sm bg-[#00a884] text-white font-semibold px-4 py-1.5 rounded-lg transition-colors hover:bg-[#017561] flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {tr('voltarAdmin')}
            </button>
          )}

          <button
            onClick={logout}
            className="text-sm bg-[#202c33] hover:bg-[#2a3942] px-4 py-1.5 rounded-lg transition-colors"
          >
            {tr('sair')}
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <ListaConversas
          conversaSelecionada={conversaSelecionada}
          onSelecionar={selecionarConversa}
        />

        <main className="flex-1 flex overflow-hidden">
          {conversaSelecionada && !mostrarMetricas ? (
            <Chat
              key={conversaSelecionada}
              conversaId={conversaSelecionada}
              onUploadChange={setUploadEmAndamento}
            />
          ) : (
            <MinhasMetricas nomeOperador={operadorNome} />
          )}
        </main>
      </div>
    </div>
  )
}
