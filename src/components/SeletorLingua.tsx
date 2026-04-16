'use client'

import { useState } from 'react'
import { useLingua } from '@/contexts/LinguaContext'
import { LINGUAS } from '@/lib/i18n'

interface Props {
  /** 'topbar' = botão com fundo semitransparente branco (para uso sobre fundo verde)
   *  'card'   = botão com fundo cinza claro (para uso sobre fundo branco) */
  variante?: 'topbar' | 'card'
}

export default function SeletorLingua({ variante = 'topbar' }: Props) {
  const { lingua, setLingua } = useLingua()
  const [aberto, setAberto] = useState(false)
  const atual = LINGUAS.find(l => l.codigo === lingua)!

  const btnCls = variante === 'topbar'
    ? 'flex items-center gap-1.5 text-sm text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors'
    : 'flex items-center gap-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors'

  return (
    <div className="relative">
      <button onClick={() => setAberto(v => !v)} className={btnCls}>
        <span>{atual.bandeira}</span>
        <span className="font-medium hidden sm:inline">{atual.label}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 mt-1.5 z-50 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-w-[150px]">
            {LINGUAS.map(l => (
              <button
                key={l.codigo}
                onClick={() => { setLingua(l.codigo); setAberto(false) }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                  lingua === l.codigo
                    ? 'bg-green-50 text-green-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{l.bandeira}</span>
                <span>{l.label}</span>
                {lingua === l.codigo && (
                  <svg className="w-3.5 h-3.5 ml-auto text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
