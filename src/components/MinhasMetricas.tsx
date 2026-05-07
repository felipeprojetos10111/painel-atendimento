'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useLingua } from '@/contexts/LinguaContext'

type Periodo = '1d' | '7d' | '30d' | 'all'

interface Resumo {
  leadsAtendidos: number
  registros:      number
  ftd:            number
  redepositos:    number
  totalValorFTD:  number
  totalValorRedepositos: number
}

interface PontoHistorico {
  label:          string
  leadsAtendidos: number
  ftd:            number
  redepositos:    number
  registros:      number
}

interface Props {
  nomeOperador: string | null
}

const CORES = {
  leadsAtendidos: '#6366f1',
  registros:      '#f59e0b',
  ftd:            '#10b981',
  redepositos:    '#3b82f6',
}

function CardMetrica({
  label, valor, sub, cor,
}: { label: string; valor: number; sub?: string; cor: string }) {
  return (
    <div className="bg-[#1f2c33] rounded-xl border border-[#2a3942] p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-[#8696a0] uppercase tracking-wide">{label}</span>
      <span className={`text-3xl font-bold ${cor}`}>{valor}</span>
      {sub && <span className="text-xs text-[#3b4a54]">{sub}</span>}
    </div>
  )
}

export default function MinhasMetricas({ nomeOperador }: Props) {
  const { tr } = useLingua()
  const [periodo, setPeriodo]     = useState<Periodo>('7d')
  const [resumo, setResumo]       = useState<Resumo | null>(null)
  const [historico, setHistorico] = useState<PontoHistorico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [seriesAtivas, setSeriesAtivas] = useState<Set<string>>(
    new Set(['leadsAtendidos', 'registros', 'ftd'])
  )

  const PERIODOS: { label: string; value: Periodo }[] = [
    { label: tr('metricasHoje'),          value: '1d'  },
    { label: `7 ${tr('metricasDias')}`,   value: '7d'  },
    { label: `30 ${tr('metricasDias')}`,  value: '30d' },
    { label: tr('metricasTudo'),          value: 'all' },
  ]

  const SERIES = [
    { key: 'leadsAtendidos', label: tr('metricasLeadsAtendidos'), cor: CORES.leadsAtendidos },
    { key: 'registros',      label: tr('metricasRegistros'),      cor: CORES.registros      },
    { key: 'ftd',            label: 'FTD',                        cor: CORES.ftd            },
  ]

  useEffect(() => {
    setCarregando(true)
    Promise.all([
      fetch(`/api/metricas/meu-desempenho?periodo=${periodo}`).then(r => r.json()),
      fetch(`/api/metricas/historico?periodo=${periodo}`).then(r => r.json()),
    ]).then(([res, hist]) => {
      setResumo(res)
      setHistorico(hist.series ?? [])
    }).finally(() => setCarregando(false))
  }, [periodo])

  function toggleSerie(key: string) {
    setSeriesAtivas(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const primeiroNome = nomeOperador?.split(' ')[0]
  const saudacao = primeiroNome
    ? `${tr('metricasOla')}, ${primeiroNome}`
    : tr('metricasMeuDesempenho')

  return (
    <div className="flex-1 overflow-y-auto bg-[#111b21] p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#e9edef]">{saudacao} 👋</h2>
          <p className="text-sm text-[#8696a0] mt-0.5">{tr('metricasSubtitulo')}</p>
        </div>

        {/* Seletor de período */}
        <div className="flex gap-1 bg-[#1f2c33] border border-[#2a3942] rounded-lg p-1 shadow-sm">
          {PERIODOS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                periodo === p.value
                  ? 'bg-[#00a884] text-white shadow-sm'
                  : 'text-[#8696a0] hover:bg-[#202c33]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de resumo */}
      {carregando ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#1f2c33] rounded-xl border border-[#2a3942] h-24 animate-pulse" />
          ))}
        </div>
      ) : resumo ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <CardMetrica label={tr('metricasLeadsAtendidos')} valor={resumo.leadsAtendidos} cor="text-indigo-400" />
          <CardMetrica label={tr('metricasRegistros')}      valor={resumo.registros}      cor="text-amber-400" />
          <CardMetrica
            label={tr('metricasPrimeiroDeposito')}
            valor={resumo.ftd}
            sub={resumo.totalValorFTD > 0 ? `$ ${resumo.totalValorFTD.toFixed(2)}` : undefined}
            cor="text-emerald-400"
          />
        </div>
      ) : null}

      {/* Gráfico histórico */}
      <div className="bg-[#1f2c33] rounded-xl border border-[#2a3942] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#8696a0]">{tr('metricasHistorico')}</h3>
          {/* Toggle de séries */}
          <div className="flex gap-2 flex-wrap justify-end">
            {SERIES.map(s => (
              <button
                key={s.key}
                onClick={() => toggleSerie(s.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  seriesAtivas.has(s.key)
                    ? 'border-transparent text-white'
                    : 'bg-[#202c33] text-[#3b4a54] border-[#2a3942]'
                }`}
                style={seriesAtivas.has(s.key) ? { backgroundColor: s.cor } : {}}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {historico.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-[#3b4a54] text-sm">
            {tr('metricasSemDados')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historico} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3942" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#2a3942" />
              <YAxis tick={{ fontSize: 11 }} stroke="#2a3942" allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: '#202c33', border: '1px solid #2a3942', color: '#e9edef' }}
              />
              {SERIES.filter(s => seriesAtivas.has(s.key)).map(s => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.cor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
