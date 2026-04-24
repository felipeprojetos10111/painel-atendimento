'use client'

// ─── Paleta de cores determinística por operador ──────────────────────────────
const CORES: { bg: string; ring: string }[] = [
  { bg: 'bg-blue-500',    ring: 'ring-blue-300' },
  { bg: 'bg-violet-500',  ring: 'ring-violet-300' },
  { bg: 'bg-pink-500',    ring: 'ring-pink-300' },
  { bg: 'bg-orange-500',  ring: 'ring-orange-300' },
  { bg: 'bg-teal-500',    ring: 'ring-teal-300' },
  { bg: 'bg-indigo-500',  ring: 'ring-indigo-300' },
  { bg: 'bg-rose-500',    ring: 'ring-rose-300' },
  { bg: 'bg-cyan-600',    ring: 'ring-cyan-300' },
  { bg: 'bg-emerald-500', ring: 'ring-emerald-300' },
  { bg: 'bg-amber-500',   ring: 'ring-amber-300' },
]

function hashNome(nome: string): number {
  let h = 0
  for (let i = 0; i < nome.length; i++) {
    h = nome.charCodeAt(i) + ((h << 5) - h)
  }
  return Math.abs(h)
}

export function corAvatar(nome: string) {
  return CORES[hashNome(nome) % CORES.length]
}

export function iniciaisNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// ─── Tamanhos disponíveis ─────────────────────────────────────────────────────
const TAMANHOS = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
}

interface Props {
  nome: string
  tamanho?: keyof typeof TAMANHOS
  /** Exibe anel de destaque ao redor do avatar */
  destaque?: boolean
  className?: string
}

export default function AvatarOperador({ nome, tamanho = 'md', destaque = false, className = '' }: Props) {
  const cor = corAvatar(nome)
  const size = TAMANHOS[tamanho]
  const ring = destaque ? `ring-2 ${cor.ring} ring-offset-1` : ''

  return (
    <div
      title={nome}
      className={`${size} ${cor.bg} ${ring} rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none ${className}`}
    >
      {iniciaisNome(nome)}
    </div>
  )
}
