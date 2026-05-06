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
  const [uploadEmAndamento, setUploadEmAndamento] = useState(false)
  const [operadorNome, setOperadorNome] = useState<string | null>(null)
  const [operadorAtivo, setOperadorAtivo] = useState(false)
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
          setOperadorNome(data.nome ?? null)
          setImpersonandoOperador(data.impersonandoOperador ?? false)
          if (data.id > 0 && data.cliente_id) setOperadorAtivo(true)
        }
      })
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
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
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.556 4.112 1.528 5.837L.057 23.943l6.254-1.641A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.579-.476-5.088-1.31l-.365-.216-3.71.974.99-3.617-.237-.376A10 10 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
          <span className="font-semibold text-lg">{tr('painelTitulo')}</span>

          {/* Botão Métricas — ao lado do nome do cliente */}
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

          {nomeCliente && (
            <span className="text-[#8696a0] text-sm font-normal border-l border-[#2a3942] pl-3 ml-1">
              {nomeCliente}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <SeletorLingua variante="topbar" />

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
