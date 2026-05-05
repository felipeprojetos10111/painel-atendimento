'use client'

import { useLingua } from '@/contexts/LinguaContext'

interface Props {
  nome: string
  onContinuar: () => void
}

export default function PopupStandby({ nome, onContinuar }: Props) {
  const { tr } = useLingua()

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-[#1c2333] rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-in fade-in zoom-in duration-200">
        {/* Ícone */}
        <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Título */}
        <h2 className="text-xl font-bold text-[#f0f6fc] mb-2">
          {nome}, {tr('standbyAinda')}
        </h2>

        {/* Descrição */}
        <p className="text-[#8b949e] text-sm mb-7 leading-relaxed">
          {tr('standbyMinutos')} <strong className="text-[#f0f6fc]">30 minutos</strong>{' '}
          {tr('standbySemInteragir')}{' '}
          <strong className="text-yellow-400">stand by</strong>.
          <br />
          {tr('standbyCliqueVoltar')}
        </p>

        {/* Botão */}
        <button
          onClick={onContinuar}
          className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold rounded-xl py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
        >
          {tr('standbyContinuar')}
        </button>
      </div>
    </div>
  )
}
