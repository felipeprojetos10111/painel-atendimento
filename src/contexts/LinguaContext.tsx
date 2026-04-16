'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Lingua, traducoes } from '@/lib/i18n'

interface LinguaContextType {
  lingua: Lingua
  setLingua: (l: Lingua) => void
  tr: (chave: string) => string
}

const LinguaContext = createContext<LinguaContextType>({
  lingua: 'pt',
  setLingua: () => {},
  tr: (chave) => chave,
})

export function LinguaProvider({ children }: { children: ReactNode }) {
  const [lingua, setLinguaState] = useState<Lingua>('pt')

  useEffect(() => {
    const salva = localStorage.getItem('lingua') as Lingua | null
    if (salva && ['pt', 'en', 'es'].includes(salva)) {
      setLinguaState(salva)
    }
  }, [])

  function setLingua(l: Lingua) {
    setLinguaState(l)
    localStorage.setItem('lingua', l)
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
