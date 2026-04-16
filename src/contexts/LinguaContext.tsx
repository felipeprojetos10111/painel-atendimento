'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Lingua, traducoes } from '@/lib/i18n'

interface LinguaContextType {
  lingua: Lingua
  setLingua: (l: Lingua) => void
  tr: (chave: string) => string
}

const LinguaContext = createContext<LinguaContextType>({
  lingua: 'en',
  setLingua: () => {},
  tr: (chave) => chave,
})

export function LinguaProvider({ children }: { children: ReactNode }) {
  const [lingua, setLinguaState] = useState<Lingua>('en')

  useEffect(() => {
    // Aplica localStorage imediatamente para evitar flash
    const salva = localStorage.getItem('lingua') as Lingua | null
    if (salva && ['pt', 'en', 'es'].includes(salva)) {
      setLinguaState(salva)
    }

    // Busca preferência salva na conta (tem precedência sobre localStorage)
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.lingua && ['pt', 'en', 'es'].includes(data.lingua)) {
          setLinguaState(data.lingua as Lingua)
          localStorage.setItem('lingua', data.lingua)
        }
      })
      .catch(() => {}) // página de login não tem auth, ignora silenciosamente
  }, [])

  function setLingua(l: Lingua) {
    setLinguaState(l)
    localStorage.setItem('lingua', l)
    // Salva na conta em segundo plano
    fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lingua: l })
    }).catch(() => {})
  }

  function tr(chave: string): string {
    return traducoes[chave]?.[lingua] ?? chave
  }

  return (
    <LinguaContext.Provider value={{ lingua, setLingua, tr }}>
      {children}
    </LinguaContext.Provider>
  )
}

export function useLingua() {
  return useContext(LinguaContext)
}
