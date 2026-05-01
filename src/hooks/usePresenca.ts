'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutos

function notificarServidor(status: 'ativo' | 'standby' | 'offline') {
  const body = JSON.stringify({ status })
  if (status === 'offline') {
    // sendBeacon garante envio mesmo ao fechar a aba
    navigator.sendBeacon?.(
      '/api/presenca',
      new Blob([body], { type: 'application/json' })
    )
  } else {
    fetch('/api/presenca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {})
  }
}

/**
 * Hook de detecção de presença/ociosidade.
 *
 * @param ativo - true quando há um operador real logado (não super_admin)
 * @returns emStandby — se o popup deve ser exibido; voltarAtivo — callback do botão
 */
export function usePresenca(ativo: boolean) {
  const [emStandby, setEmStandby] = useState(false)
  const emStandbyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef(Date.now())

  const entrarStandby = useCallback(() => {
    if (emStandbyRef.current) return
    emStandbyRef.current = true
    setEmStandby(true)
    notificarServidor('standby')
  }, [])

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(entrarStandby, IDLE_TIMEOUT)
  }, [entrarStandby])

  const voltarAtivo = useCallback(() => {
    emStandbyRef.current = false
    setEmStandby(false)
    notificarServidor('ativo')
    resetTimer()
  }, [resetTimer])

  useEffect(() => {
    if (!ativo) return

    // Abre sessão ativa ao montar
    notificarServidor('ativo')
    resetTimer()

    const handleActivity = () => {
      // Ignora atividade enquanto está em standby
      if (!emStandbyRef.current) resetTimer()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) return
      // Aba voltou ao foco — verifica se o tempo já expirou
      const elapsed = Date.now() - lastActivityRef.current
      if (elapsed >= IDLE_TIMEOUT && !emStandbyRef.current) {
        entrarStandby()
      }
    }

    const handleBeforeUnload = () => {
      notificarServidor('offline')
    }

    const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const
    eventos.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      eventos.forEach(e => window.removeEventListener(e, handleActivity))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (timerRef.current) clearTimeout(timerRef.current)
      notificarServidor('offline')
    }
  }, [ativo, entrarStandby, resetTimer])

  return { emStandby, voltarAtivo }
}
