'use client'

interface Props {
  nome: string
  onContinuar: () => void
}

export default function PopupStandby({ nome, onContinuar }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-in fade-in zoom-in duration-200">
        {/* Ícone */}
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Título */}
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          {nome}, ainda está aí?
        </h2>

        {/* Descrição */}
        <p className="text-gray-500 text-sm mb-7 leading-relaxed">
          Você ficou <strong className="text-gray-700">30 minutos</strong> sem interagir com
          o painel. Seu status foi marcado como <strong className="text-yellow-600">stand by</strong>.
          <br />
          Clique para voltar como disponível.
        </p>

        {/* Botão */}
        <button
          onClick={onContinuar}
          className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold rounded-xl py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
        >
          ✓ Continuar atendendo
        </button>
      </div>
    </div>
  )
}
