# CLAUDE.md — Contexto do Projeto: Plataforma de Atendimento WhatsApp

Este arquivo documenta o estado completo da plataforma para uso em sessões futuras com Claude Code.
Última atualização: 2026-05-29

---

## Visão Geral

Sistema de atendimento ao cliente via WhatsApp composto por dois projetos Node.js que compartilham o mesmo banco de dados PostgreSQL, deployados em VPS (mypainel.site, SSH: `ssh -i ~/.ssh/vps_claude root@mypainel.site`).

| Projeto | Tecnologia | Porta | Repositório | Caminho VPS |
|---|---|---|---|---|
| `whatsapp-gateway` | Express.js + Prisma | 3000 | `github.com/felipeprojetos10111/whatsapp-gateway` | `/var/www/whatsapp-gateway` |
| `painel-atendimento` | Next.js 16 + Socket.io | 3001 | `github.com/felipeprojetos10111/painel-atendimento` | `/var/www/painel-atendimento` |

**Banco de dados:** PostgreSQL — `plataforma_atendimento` (usuário: `felipehayashi`)  
**Process manager:** PM2 (IDs: 0 = whatsapp-gateway, 11 = painel-atendimento)  
**Nginx:** Proxy reverso — mypainel.site → porta 3001; /webhook → porta 3000  
**Deploy padrão:** `git push` local → `git pull` no VPS → `npm run build` → `pm2 restart`

---

## Projeto 1: whatsapp-gateway

### O que faz
Recebe mensagens do WhatsApp Business via webhook do Meta, aciona IA para triagem automática, salva no banco, baixa mídias para R2 e envia respostas via WhatsApp Cloud API.

### Estrutura de arquivos
```
whatsapp-gateway/
├── src/
│   ├── app.js          # Servidor Express, conecta ao banco, monta rotas
│   ├── webhook.js      # Webhook principal — recebe mensagens, processa, notifica painel
│   ├── ai.js           # Triagem com Claude (Anthropic SDK)
│   ├── whatsapp.js     # Envia mensagens via WhatsApp Cloud API (axios)
│   ├── database.js     # Singleton PrismaClient
│   ├── r2.js           # Upload de mídias para Cloudflare R2 (AWS SDK S3) ← NOVO
│   ├── transcricao.js  # Transcrição de áudios via Groq Whisper
│   └── notificar.js    # Notifica painel via Socket.io
├── prisma/
│   └── schema.prisma   # Schema completo (inclui regras_escala) ← ATUALIZADO
├── .env
└── package.json
```

### Funcionalidades implementadas no webhook.js

**Recebimento de mensagens:**
- Texto, imagem, vídeo, áudio, documento
- Validação HMAC-SHA256 no webhook real
- Transcrição de áudios via Groq Whisper
- **Mídias salvas permanentemente no R2** (em vez de URL temporária do WhatsApp)
  - Função `baixarMidiaParaR2(mediaId, token, tipoWA)` em `src/r2.js`
  - Para áudios: salva no R2 em paralelo com a transcrição
  - Fallback: se R2 falhar, usa URL temporária do WhatsApp

**Distribuição automática (Regras de Escala):**
- `verificarRegraEscala(clienteId, texto)` — string-similarity ≥ 90% (Dice coefficient)
- Verifica regras ANTES do sticky operator
- Modelo `regras_escala` no schema do gateway (obrigatório — schema separado do painel)

**Sticky operator:** lead que retorna é reatribuído ao operador da última conversa

**Status de mensagens:** atualiza `status` no banco quando WhatsApp confirma entrega/leitura

### Variáveis de ambiente (.env no VPS)
```
PORT=3000
VERIFY_TOKEN=minha_plataforma_2024
APP_SECRET=<app_secret_do_meta>
DATABASE_URL="postgresql://felipehayashi@localhost:5432/plataforma_atendimento"
ANTHROPIC_API_KEY=<chave>
GROQ_API_KEY=<chave_groq>
R2_ACCESS_KEY_ID=c45c211d4b8c0adb9d1f2fc55f4da31c
R2_SECRET_ACCESS_KEY=<secret>
R2_ENDPOINT=https://50e731305e1fadda72cd2a1a18ed0aec.r2.cloudflarestorage.com
R2_BUCKET=plataforma-midia
R2_PUBLIC_URL=https://pub-5bc83ba1587542bbbc723324729bd21e.r2.dev
```

---

## Projeto 2: painel-atendimento

### O que faz
Interface web para operadores humanos. Chat em tempo real, respostas rápidas com mídia, IA no chat, tradução de mensagens de leads, painel admin.

### Estrutura de arquivos (principais)
```
painel-atendimento/
├── src/
│   ├── app/
│   │   ├── painel/page.tsx                              # Painel principal
│   │   ├── admin/page.tsx                               # Admin: respostas, operadores, regras de escala
│   │   ├── minhas-respostas/page.tsx                    # Operador gerencia suas respostas rápidas
│   │   └── api/
│   │       ├── auth/me/route.ts                         # GET: dados do operador logado (inclui idioma_traducao)
│   │       ├── conversas/[id]/mensagens/
│   │       │   ├── route.ts                             # GET/POST mensagens
│   │       │   └── sequencia/route.ts                   # POST: envio sequencial com delay por item
│   │       ├── ia/
│   │       │   ├── texto/route.ts                       # POST: melhorar texto | traduzir texto de saída
│   │       │   └── config/route.ts                      # Configurações de IA
│   │       ├── mensagens/traduzir/route.ts              # POST: traduzir mensagens do lead (batch) ← NOVO
│   │       ├── media-proxy/route.ts                     # GET: proxy autenticado para mídias WhatsApp ← NOVO
│   │       ├── operadores/preferencias/route.ts         # PATCH: salva idioma_traducao do operador ← NOVO
│   │       ├── regras-escala/route.ts                   # GET/POST regras de distribuição ← NOVO
│   │       ├── regras-escala/[id]/route.ts              # PATCH/DELETE regras ← NOVO
│   │       └── respostas-rapidas/
│   │           ├── route.ts                             # GET/POST (com prisma.$transaction)
│   │           ├── [id]/route.ts                        # PATCH/DELETE
│   │           ├── reordenar/route.ts                   # PATCH: salva nova ordem (drag-and-drop) ← NOVO
│   │           └── upload/route.ts                      # POST: upload para R2
│   ├── components/
│   │   ├── Chat.tsx                                     # Chat completo (ver detalhes abaixo)
│   │   └── ModalRespostasRapidas.tsx
│   └── lib/
│       ├── whatsapp.ts                                  # Envia mídia com conversão FFmpeg para OGG/Opus
│       └── r2.ts                                        # Upload/delete R2
├── prisma/schema.prisma                                 # Schema atualizado (ver abaixo)
└── server.js
```

### Chat.tsx — funcionalidades
- **Melhorar texto:** botão no toolbar → chama `/api/ia/texto` com `acao: 'melhorar'` → substitui texto no campo
- **Traduzir texto de saída:** botão + seletor 🇧🇷/🇺🇸/🇪🇸 no toolbar → chama `/api/ia/texto` com `acao: 'traduzir'`
- **Tradução de mensagens do lead:** botão 💬 no HEADER (não toolbar) com seletor de idioma → chama `/api/mensagens/traduzir` → exibe tradução em itálico abaixo de cada mensagem do lead
  - Toggle ON/OFF salvo em localStorage
  - Idioma salvo no banco (`operadores.idioma_traducao`)
  - Auto-traduz ao abrir nova conversa se toggle estiver ON
  - Tradução salva no banco — segunda abertura é instantânea
  - Tradução por intenção (não literal) — interpreta erros de ortografia e contexto
- **Proxy de mídia:** URLs do WhatsApp passam por `/api/media-proxy` com fallback de refresh via Graph API
- **Gravação de voz:** WebM → upload R2 → FFmpeg converte para OGG/Opus antes de enviar ao WhatsApp
- **Envio sequencial:** respostas rápidas multi-item com `delay_depois` por item (0–120s)

### Página admin — abas
1. **Respostas Rápidas** — CRUD com upload de mídia
2. **Operadores** — cadastro, ativar/desativar, deletar
3. **Regras de Escala** — vincular texto de referência a operador (≥90% similaridade)

### Página minhas-respostas
- Operador gerencia suas próprias respostas rápidas
- Drag-and-drop para reordenar (ordem salva no banco, reflete no modal de envio)
- Multi-item com delay por item (input âmbar entre itens)
- Botão Melhorar + Traduzir para mensagem de saída
- Link de registro com mensagem personalizada

---

## Banco de Dados — Schema atual

### Tabelas principais e campos relevantes

**`mensagens`**
```sql
id, conversa_id, origem (lead/ia/operador), conteudo, tipo, url_midia,
whatsapp_id, status, enviado_em,
traducao TEXT,          -- ← NOVO: tradução da mensagem do lead
traducao_idioma VARCHAR(5)  -- ← NOVO: idioma em que foi traduzida (pt/en/es)
```

**`operadores`**
```sql
id, cliente_id, nome, email, senha_hash, nivel, ativo, na_fila,
lingua, link_plataforma, affiliate_link_id, mensagem_link,
idioma_traducao VARCHAR(5) DEFAULT 'pt'  -- ← NOVO: idioma preferido para tradução
```

**`respostas_rapidas`**
```sql
id, cliente_id, operador_id, titulo, tipo, conteudo, url_midia,
categoria, atalho, ativo, criado_em,
ordem INT DEFAULT 0  -- ← NOVO: ordem de exibição (drag-and-drop)
```

**`respostas_rapidas_itens`**
```sql
id, resposta_id, ordem, tipo, conteudo, url_midia, criado_em,
delay_depois INT DEFAULT 0  -- ← NOVO: delay em segundos antes do próximo item
```

**`regras_escala`** ← NOVA TABELA
```sql
id, cliente_id, mensagem_referencia TEXT, operador_id INT,
ativo BOOLEAN DEFAULT true, criado_em TIMESTAMP
INDEX: (cliente_id, ativo)
```

---

## Funcionalidades implementadas nesta sessão

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Delay por item em respostas rápidas | ✅ Concluído | Campo `delay_depois` por item, UI com input âmbar entre itens |
| Drag-and-drop para reordenar respostas | ✅ Concluído | Coluna `ordem` no banco, endpoint `/reordenar` |
| Regras de Escala automática | ✅ Concluído | string-similarity ≥90%, painel admin aba dedicada |
| Salvar mídias de leads no R2 | ✅ Concluído | Download imediato ao receber, URL permanente |
| Proxy de mídia WhatsApp | ✅ Concluído | `/api/media-proxy` com refresh via Graph API quando 401 |
| Áudio: conversão WebM→OGG/Opus via FFmpeg | ✅ Concluído | Evita "verificar email" no WhatsApp do lead |
| Botão Melhorar texto no chat | ✅ Concluído | Revisa ortografia e clareza sem mudar sentido |
| Botão Traduzir texto de saída | ✅ Concluído | PT/EN/ES no toolbar, independente da tradução de lead |
| Tradução de mensagens do lead | ✅ Concluído | Toggle no header, por intenção (não literal), batch, cache no banco |
| Auto-tradução ao abrir conversa | ✅ Concluído | Se toggle ON, traduz automaticamente ao mudar de conversa |
| Respostas rápidas com múltiplos itens | ✅ Concluído | Envio sequencial, delay configurável por item |
| Visualização de imagens/vídeos de leads | ✅ Concluído | Via proxy autenticado, refresh automático de URLs expiradas |

---

## Decisões Técnicas Relevantes

- **`jose` em vez de `jsonwebtoken`** no middleware: compatível com Edge Runtime do Next.js
- **`server.js` customizado** com `@next/env`: carrega `.env.local` antes do Next.js iniciar
- **Upload direto para R2**: browser faz PUT na URL pré-assinada, evita gargalo no servidor
- **Prisma v5** (não v7): compatibilidade entre gateway e painel
- **Dois schemas Prisma separados**: gateway e painel têm schemas independentes — qualquer novo model precisa ser adicionado nos DOIS e `prisma generate` executado nos DOIS
- **FFmpeg no VPS** (`/usr/bin/ffmpeg`): usado para converter áudio WebM→OGG/Opus antes de enviar ao WhatsApp (voice notes nativos)
- **Tradução por intenção**: prompt instrui Claude a interpretar o que o lead quis dizer (com erros de ortografia/gramática) antes de traduzir, não tradução literal
- **`prisma.$transaction`** no POST de respostas rápidas: evita registros órfãos se a criação dos itens falhar
- **Filtro Prisma com NULL**: usar `OR: [{ campo: null }, { campo: { not: valor } }]` em vez de `NOT: { campo: valor }` — o NOT não captura NULLs em SQL
- **Cache `meCache`** em Chat.tsx: singleton de sessão para `/api/auth/me`, evita múltiplos fetches

---

## Arquitetura de Notificação em Tempo Real

```
Lead envia mensagem WhatsApp
    ↓
gateway (porta 3000) recebe via webhook
    ↓
Salva no banco + baixa mídia para R2
    ↓
Chama notificarPainel() via Socket.io interno
    ↓
painel (porta 3001) emite 'nova-mensagem' para sala da conversa
    ↓
Chat.tsx e ListaConversas.tsx atualizam em tempo real
```

---

## Comandos úteis no VPS

```bash
# Ver logs em tempo real
pm2 logs painel-atendimento --lines 50
pm2 logs whatsapp-gateway --lines 50

# Reiniciar serviços
pm2 restart painel-atendimento
pm2 restart whatsapp-gateway

# Deploy painel
cd /var/www/painel-atendimento && git pull && npm run build && pm2 restart painel-atendimento

# Deploy gateway
cd /var/www/whatsapp-gateway && git pull && npm install && pm2 restart whatsapp-gateway

# Gerar Prisma client (após mudanças no schema)
cd /var/www/painel-atendimento && npx prisma generate
cd /var/www/whatsapp-gateway && npx prisma generate

# SQL direto
sudo -u postgres psql plataforma_atendimento
```

---

## Clientes cadastrados

| ID | Nome | phone_number_id | Observações |
|---|---|---|---|
| 5 | The North | 1346344811886247 | Principal cliente ativo |

---

## Próximos Passos Sugeridos

*(itens que o usuário mencionou ter mais atualizações para fazer)*

1. Continuar com as novas atualizações listadas pelo usuário na próxima sessão
2. **Histórico de conversas encerradas** — filtro por status `resolvida`
3. **Notificações sonoras** — alerta quando chegar nova mensagem
4. **Métricas e relatórios** — dashboard de desempenho dos operadores
5. **Fila de atendimento** — lógica de distribuição automática com a tabela `filas`
