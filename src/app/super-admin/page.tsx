'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Cliente {
  id: number
  nome: string
  slug: string
  ativo: boolean
  phone_number_id: string | null
  whatsapp_ok: boolean
  ia_ok: boolean
  operadores: number
  conversas: number
  leads: number
  criado_em: string | null
}

interface FormCliente {
  nome: string
  slug: string
  whatsapp_token: string
  phone_number_id: string
  app_secret: string
  verify_token: string
  ia_api_key: string
  admin_nome: string
  admin_email: string
  admin_senha: string
}

const FORM_VAZIO: FormCliente = {
  nome: '', slug: '',
  whatsapp_token: '', phone_number_id: '', app_secret: '', verify_token: '',
  ia_api_key: '',
  admin_nome: '', admin_email: '', admin_senha: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function gerarSlug(nome: string) {
  return nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── Componentes menores ───────────────────────────────────────────────────────
function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      <span>{ok ? '✓' : '–'}</span> {label}
    </span>
  )
}

function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const router = useRouter()
  const [clientes, setClientes]         = useState<Cliente[]>([])
  const [carregando, setCarregando]     = useState(true)
  const [modalAberto, setModalAberto]   = useState(false)
  const [editando, setEditando]         = useState<Cliente | null>(null)
  const [form, setForm]                 = useState<FormCliente>(FORM_VAZIO)
  const [salvando, setSalvando]         = useState(false)
  const [erro, setErro]                 = useState('')
  const [impersonando, setImpersonando] = useState<number | null>(null)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  // Carrega clientes
  async function carregarClientes() {
    setCarregando(true)
    try {
      const res = await fetch('/api/super-admin/clientes')
      if (res.ok) setClientes(await res.json())
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregarClientes() }, [])

  // Abre modal de novo cliente
  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setErro('')
    setModalAberto(true)
  }

  // Abre modal de edição (só credenciais — não refaz admin)
  function abrirEdicao(c: Cliente) {
    setEditando(c)
    setForm({ ...FORM_VAZIO, nome: c.nome, slug: c.slug })
    setErro('')
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setEditando(null) }

  function setField(campo: keyof FormCliente, valor: string) {
    setForm(f => {
      const novo = { ...f, [campo]: valor }
      // Auto-gera slug ao digitar nome (só em novo cliente)
      if (campo === 'nome' && !editando) novo.slug = gerarSlug(valor)
      return novo
    })
  }

  // Salva (cria ou edita)
  async function salvar() {
    setErro(''); setSalvando(true)
    try {
      let res: Response
      if (editando) {
        res = await fetch(`/api/super-admin/clientes/${editando.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome:            form.nome            || undefined,
            slug:            form.slug            || undefined,
            whatsapp_token:  form.whatsapp_token  || undefined,
            phone_number_id: form.phone_number_id || undefined,
            app_secret:      form.app_secret      || undefined,
            verify_token:    form.verify_token    || undefined,
            ia_api_key:      form.ia_api_key      || undefined,
          })
        })
      } else {
        res = await fetch('/api/super-admin/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        })
      }

      const data = await res.json()
      if (!res.ok) { setErro(data.erro ?? 'Erro ao salvar.'); return }

      fecharModal()
      carregarClientes()
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  // Entra como admin do cliente
  async function entrarComoAdmin(c: Cliente) {
    setImpersonando(c.id)
    try {
      const res = await fetch('/api/super-admin/impersonar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: c.id }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.erro ?? 'Erro ao entrar como admin.'); return }
      router.push('/admin')
    } finally {
      setImpersonando(null)
    }
  }

  // Alterna ativo/inativo
  async function toggleAtivo(c: Cliente) {
    await fetch(`/api/super-admin/clientes/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !c.ativo })
    })
    carregarClientes()
  }

  // Estatísticas do topo
  const total   = clientes.length
  const ativos  = clientes.filter(c => c.ativo).length
  const inativos = total - ativos

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Super Admin</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestão de clientes da plataforma</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={abrirNovo}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Novo Cliente
          </button>
          <button
            onClick={logout}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Sair
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Métricas */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total de clientes', valor: total,   cor: 'text-gray-900' },
            { label: 'Ativos',            valor: ativos,  cor: 'text-green-600' },
            { label: 'Inativos',          valor: inativos, cor: 'text-red-500' },
          ].map(({ label, valor, cor }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className={`text-3xl font-bold ${cor}`}>{valor}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Lista de clientes */}
        {carregando ? (
          <div className="text-center py-16 text-gray-400">Carregando...</div>
        ) : clientes.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center">
            <p className="text-gray-400 text-sm">Nenhum cliente cadastrado ainda.</p>
            <button onClick={abrirNovo} className="mt-3 text-green-600 text-sm font-semibold hover:underline">
              Criar primeiro cliente →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {clientes.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                {/* Ativo indicator */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${c.ativo ? 'bg-green-400' : 'bg-gray-300'}`} />

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{c.nome}</span>
                    <span className="text-xs text-gray-400 font-mono">/{c.slug}</span>
                    <StatusBadge ativo={c.ativo} />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge ok={c.whatsapp_ok} label="WhatsApp" />
                    <Badge ok={c.ia_ok} label="IA própria" />
                    <span className="text-xs text-gray-400">{c.operadores} operadores · {c.conversas} conversas · {c.leads} leads</span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => entrarComoAdmin(c)}
                    disabled={impersonando === c.id}
                    className="flex items-center gap-1.5 text-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {impersonando === c.id
                      ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                    }
                    Entrar como Admin
                  </button>
                  <button
                    onClick={() => abrirEdicao(c)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleAtivo(c)}
                    className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      c.ativo
                        ? 'text-red-500 hover:text-red-600 hover:bg-red-50'
                        : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                    }`}
                  >
                    {c.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal criar / editar */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editando ? `Editar: ${editando.nome}` : 'Novo Cliente'}
              </h2>
              <button onClick={fecharModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Dados da empresa */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Dados da empresa</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                    <input
                      value={form.nome}
                      onChange={e => setField('nome', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Empresa XYZ"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                    <input
                      value={form.slug}
                      onChange={e => setField('slug', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="empresa-xyz"
                    />
                  </div>
                </div>
              </section>

              {/* Credenciais WhatsApp */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">API do WhatsApp (Meta)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Token</label>
                    <input
                      value={form.whatsapp_token}
                      onChange={e => setField('whatsapp_token', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="EAAZAhaTBgt..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
                      <input
                        value={form.phone_number_id}
                        onChange={e => setField('phone_number_id', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="1041685662366322"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Verify Token</label>
                      <input
                        value={form.verify_token}
                        onChange={e => setField('verify_token', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="minha_empresa_2024"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">App Secret</label>
                    <input
                      type="password"
                      value={form.app_secret}
                      onChange={e => setField('app_secret', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  URL do webhook a configurar no Meta: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/webhook</span>
                </p>
              </section>

              {/* Chave de IA */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">IA (opcional)</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chave de API própria
                    <span className="text-gray-400 font-normal ml-1">(vazio = usa chave global da plataforma)</span>
                  </label>
                  <input
                    type="password"
                    value={form.ia_api_key}
                    onChange={e => setField('ia_api_key', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="sk-ant-... / sk-... / AIza..."
                  />
                </div>
              </section>

              {/* Primeiro admin — só em novo cliente */}
              {!editando && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Primeiro administrador *</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                      <input
                        value={form.admin_nome}
                        onChange={e => setField('admin_nome', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="João Silva"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={form.admin_email}
                          onChange={e => setField('admin_email', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="admin@empresa.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                        <input
                          type="password"
                          value={form.admin_senha}
                          onChange={e => setField('admin_senha', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {erro && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
              )}
            </div>

            {/* Footer modal */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={fecharModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
