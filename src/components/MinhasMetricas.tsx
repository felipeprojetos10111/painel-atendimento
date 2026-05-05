'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

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

const PERIODOS: { label: string; value: Periodo }[] = [
  { label: 'Hoje',    value: '1d'  },
  { label: '7 dias',  value: '7d'  },
  { label: '30 dias', value: '30d' },
  { label: 'Tudo',    value: 'all' },
]

const SERIES = [
  { key: 'leadsAtendidos', label: 'Leads atendidos', cor: '#6366f1' },
  { key: 'registros',      label: 'Registros',       cor: '#f59e0b' },
  { key: 'ftd',            label: 'FTD',             cor: '#10b981' },
  { key: 'redepositos',    label: 'Redepósitos',     cor: '#3b82f6' },
]

function CardMetrica({
  label, valor, sub, cor,
}: { label: string; valor: number; sub?: string; cor: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-3xl font-bold ${cor}`}>{valor}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

export default function MinhasMetricas({ nomeOperador }: Props) {
  const [periodo, setPeriodo]     = useState<Periodo>('7d')
  const [resumo, setResumo]       = useState<Resumo | null>(null)
  const [historico, setHistorico] = useState<PontoHistorico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [seriesAtivas, setSeriesAtivas] = useState<Set<string>>(
    new Set(['leadsAtendidos', 'registros', 'ftd', 'redepositos'])
  )

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

  const saudacao = nomeOperador ? `Olá, ${nomeOperador.split(' ')[0]}` : 'Meu desempenho'

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{saudacao} 👋</h2>
          <p className="text-sm text-gray-500 mt-0.5">Acompanhe seu desempenho</p>
        </div>

        {/* Seletor de período */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
          {PERIODOS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                periodo === p.value
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de resumo */}
      {carregando ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 h-24 animate-pulse" />
          ))}
        </div>
      ) : resumo ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <CardMetrica label="Leads atendidos" valor={resumo.leadsAtendidos} cor="text-indigo-600" />
          <CardMetrica label="Registros"       valor={resumo.registros}      cor="text-amber-600" />
          <CardMetrica
            label="Primeiros depósitos"
            valor={resumo.ftd}
            sub={resumo.totalValorFTD > 0 ? `$ ${resumo.totalValorFTD.toFixed(2)}` : undefined}
            cor="text-emerald-600"
          />
          <CardMetrica
            label="Redepósitos"
            valor={resumo.redepositos}
            sub={resumo.totalValorRedepositos > 0 ? `$ ${resumo.totalValorRedepositos.toFixed(2)}` : undefined}
            cor="text-blue-600"
          />
        </div>
      ) : null}

      {/* Gráfico histórico */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Histórico</h3>
          {/* Toggle de séries */}
          <div className="flex gap-2 flex-wrap justify-end">
            {SERIES.map(s => (
              <button
                key={s.key}
                onClick={() => toggleSerie(s.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  seriesAtivas.has(s.key)
                    ? 'border-transparent text-white'
                    : 'bg-white text-gray-400 border-gray-200'
                }`}
                style={seriesAtivas.has(s.key) ? { backgroundColor: s.cor } : {}}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {historico.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
            Nenhum dado no período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historico} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#d1d5db" />
              <YAxis tick={{ fontSize: 11 }} stroke="#d1d5db" allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
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
