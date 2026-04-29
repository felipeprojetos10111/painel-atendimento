export type Lingua = 'pt' | 'en' | 'es'

export const LINGUAS = [
  { codigo: 'pt' as Lingua, label: 'Português', bandeira: '🇵🇹' },
  { codigo: 'en' as Lingua, label: 'English',   bandeira: '🇺🇸' },
  { codigo: 'es' as Lingua, label: 'Español',   bandeira: '🇪🇸' },
] as const

export const traducoes: Record<string, Record<Lingua, string>> = {
  // ── Login ──────────────────────────────────────────────────────────────────
  loginTitulo:    { pt: 'Painel de Atendimento',     en: 'Attendance Panel',          es: 'Panel de Atención' },
  loginSubtitulo: { pt: 'Faça login para continuar', en: 'Log in to continue',        es: 'Inicia sesión para continuar' },
  email:          { pt: 'Email',                     en: 'Email',                     es: 'Correo electrónico' },
  senha:          { pt: 'Senha',                     en: 'Password',                  es: 'Contraseña' },
  entrar:         { pt: 'Entrar',                    en: 'Log in',                    es: 'Entrar' },
  entrando:       { pt: 'Entrando...',               en: 'Logging in...',             es: 'Entrando...' },
  erroLogin:      { pt: 'Erro ao fazer login.',      en: 'Login error.',              es: 'Error al iniciar sesión.' },

  // ── Topbar ─────────────────────────────────────────────────────────────────
  painelTitulo: { pt: 'Painel de Atendimento', en: 'Attendance Panel', es: 'Panel de Atención' },
  sair:         { pt: 'Sair',                  en: 'Logout',           es: 'Salir' },

  // ── Painel vazio ───────────────────────────────────────────────────────────
  selecioneConversa: { pt: 'Selecione uma conversa para começar', en: 'Select a conversation to start', es: 'Selecciona una conversación para empezar' },

  // ── Lista de conversas ─────────────────────────────────────────────────────
  conversas:      { pt: 'Conversas',                       en: 'Conversations',              es: 'Conversaciones' },
  buscarConversa: { pt: 'Buscar por nome ou telefone...',  en: 'Search by name or phone...', es: 'Buscar por nombre o teléfono...' },
  nenhumaConversa:{ pt: 'Nenhuma conversa encontrada.',    en: 'No conversations found.',    es: 'No se encontraron conversaciones.' },

  // ── Status ─────────────────────────────────────────────────────────────────
  statusAguardando:    { pt: 'Aguardando',     en: 'Waiting',     es: 'Esperando' },
  statusEmAtendimento: { pt: 'Em atendimento', en: 'In progress', es: 'En atención' },
  statusEscalada:      { pt: 'Escalada',       en: 'Escalated',   es: 'Escalada' },
  statusResolvida:     { pt: 'Resolvida',      en: 'Resolved',    es: 'Resuelta' },

  // ── Toast ──────────────────────────────────────────────────────────────────
  toastEscalada: { pt: '🚨 Conversa escalada para humano', en: '🚨 Conversation escalated to human', es: '🚨 Conversación escalada a humano' },
  urgencia:      { pt: 'Urgência:',                        en: 'Urgency:',                          es: 'Urgencia:' },
  ver:           { pt: 'Ver',                              en: 'View',                               es: 'Ver' },

  // ── Chat ───────────────────────────────────────────────────────────────────
  conversa:         { pt: 'Conversa',               en: 'Conversation',     es: 'Conversación' },
  statusLabel:      { pt: 'Status:',                en: 'Status:',          es: 'Estado:' },
  enviar:           { pt: 'Enviar', en: 'Send', es: 'Enviar' },
  digiteMensagem:   { pt: 'Digite sua mensagem...', en: 'Type your message...', es: 'Escribe tu mensaje...' },
  respostasRapidas: { pt: 'Respostas rápidas',      en: 'Quick replies',    es: 'Respuestas rápidas' },
  anexarArquivo:    { pt: 'Anexar',                 en: 'Attach',           es: 'Adjuntar' },
  dicaEnvio:        { pt: 'Enter para enviar · Shift+Enter para nova linha', en: 'Enter to send · Shift+Enter for new line', es: 'Enter para enviar · Shift+Enter para nueva línea' },
  gravarAudio:      { pt: 'Gravar voz',             en: 'Record voice',     es: 'Grabar voz' },
  gravando:         { pt: 'Gravando...',             en: 'Recording...',     es: 'Grabando...' },
  enviarAudio:      { pt: 'Enviar áudio',            en: 'Send audio',       es: 'Enviar audio' },
  descartarAudio:   { pt: 'Descartar',               en: 'Discard',          es: 'Descartar' },
  origemLead:       { pt: 'Lead',                   en: 'Lead',             es: 'Lead' },
  origemIA:         { pt: 'IA',                     en: 'AI',               es: 'IA' },
  origemVoce:       { pt: 'Você',                   en: 'You',              es: 'Tú' },

  // ── Modal respostas rápidas ────────────────────────────────────────────────
  respostasRapidasTitulo:    { pt: 'Respostas Rápidas', en: 'Quick Replies',    es: 'Respuestas Rápidas' },
  buscarRespostas:           { pt: 'Buscar por título, #atalho ou categoria...', en: 'Search by title, #shortcut or category...', es: 'Buscar por título, #acceso o categoría...' },
  dicaAtalho:                { pt: 'Digite',                          en: 'Type',                             es: 'Escribe' },
  dicaAtalhoMeio:            { pt: 'para buscar pelo atalho diretamente', en: 'to search by shortcut directly', es: 'para buscar por acceso directo' },
  nenhumaRespostaEncontrada: { pt: 'Nenhuma resposta encontrada.',    en: 'No replies found.',                es: 'No se encontraron respuestas.' },
  respostaDisponivel:        { pt: 'resposta disponível',             en: 'reply available',                  es: 'respuesta disponible' },
  respostasDisponiveis:      { pt: 'respostas disponíveis',           en: 'replies available',                es: 'respuestas disponibles' },
  cliqueEnviar:              { pt: 'Clique para enviar direto',       en: 'Click to send directly',           es: 'Haz clic para enviar' },
  carregando:                { pt: 'Carregando...',                   en: 'Loading...',                       es: 'Cargando...' },
  semCategoria:              { pt: 'Sem categoria',                   en: 'No category',                      es: 'Sin categoría' },

  // ── Tipos de resposta rápida ───────────────────────────────────────────────
  tipoTexto:     { pt: 'Texto',     en: 'Text',     es: 'Texto' },
  tipoImagem:    { pt: 'Imagem',    en: 'Image',    es: 'Imagen' },
  tipoAudio:     { pt: 'Áudio',     en: 'Audio',    es: 'Audio' },
  tipoVideo:     { pt: 'Vídeo',     en: 'Video',    es: 'Vídeo' },
  tipoDocumento: { pt: 'Documento', en: 'Document', es: 'Documento' },

  // ── Admin geral ────────────────────────────────────────────────────────────
  administracao:   { pt: 'Administração',     en: 'Administration', es: 'Administración' },
  voltarAoPainel:  { pt: 'Voltar ao painel',  en: 'Back to panel',  es: 'Volver al panel' },
  supervisorLabel: { pt: 'supervisor',        en: 'supervisor',     es: 'supervisor' },
  abaOperadores:   { pt: '👥 Operadores',     en: '👥 Operators',   es: '👥 Operadores' },

  // ── Admin — respostas rápidas ──────────────────────────────────────────────
  novaRespostaRapida:        { pt: 'Nova resposta rápida',                    en: 'New quick reply',               es: 'Nueva respuesta rápida' },
  tituloField:               { pt: 'Título',                                  en: 'Title',                         es: 'Título' },
  categoriaField:            { pt: 'Categoria',                               en: 'Category',                      es: 'Categoría' },
  atalhoField:               { pt: 'Atalho',                                  en: 'Shortcut',                      es: 'Acceso directo' },
  opcional:                  { pt: 'opcional',                                en: 'optional',                      es: 'opcional' },
  tipoField:                 { pt: 'Tipo',                                    en: 'Type',                          es: 'Tipo' },
  conteudoField:             { pt: 'Conteúdo',                                en: 'Content',                       es: 'Contenido' },
  conteudoPlaceholder:       { pt: 'Digite o texto da resposta rápida...',    en: 'Type the quick reply text...',  es: 'Escribe el texto de la respuesta rápida...' },
  cadastrarResposta:         { pt: 'Cadastrar resposta',                      en: 'Register reply',                es: 'Registrar respuesta' },
  salvando:                  { pt: 'Salvando...',                             en: 'Saving...',                     es: 'Guardando...' },
  enviandoArquivo:           { pt: 'Enviando arquivo...',                     en: 'Uploading file...',             es: 'Subiendo archivo...' },
  respostasCadastradas:      { pt: 'Respostas cadastradas',                   en: 'Registered replies',            es: 'Respuestas registradas' },
  filtrarPlaceholder:        { pt: 'Filtrar...',                              en: 'Filter...',                     es: 'Filtrar...' },
  nenhumaRespostaCadastrada: { pt: 'Nenhuma resposta rápida cadastrada.',     en: 'No quick replies registered.',  es: 'No hay respuestas rápidas registradas.' },
  cliqueSelecionarArquivo:   { pt: 'Clique para selecionar',                  en: 'Click to select',               es: 'Haz clic para seleccionar' },
  inativa:                   { pt: 'inativa',                                 en: 'inactive',                      es: 'inactiva' },
  confirmarDeletarResposta:  { pt: 'Deletar esta resposta rápida?',           en: 'Delete this quick reply?',      es: '¿Eliminar esta respuesta rápida?' },
  sucessoResposta:           { pt: 'Resposta rápida cadastrada com sucesso!', en: 'Quick reply registered successfully!', es: '¡Respuesta rápida registrada con éxito!' },
  arquivoDe:                 { pt: 'Arquivo de',                              en: 'File for',                      es: 'Archivo de' },

  // ── Admin — operadores ─────────────────────────────────────────────────────
  novoOperador:          { pt: 'Novo operador',          en: 'New operator',          es: 'Nuevo operador' },
  nomeField:             { pt: 'Nome',                   en: 'Name',                  es: 'Nombre' },
  nivelField:            { pt: 'Nível',                  en: 'Level',                 es: 'Nivel' },
  nivelOperador:         { pt: 'Operador',               en: 'Operator',              es: 'Operador' },
  nivelSupervisor:       { pt: 'Supervisor',             en: 'Supervisor',            es: 'Supervisor' },
  cadastrarOperador:     { pt: 'Cadastrar operador',     en: 'Register operator',     es: 'Registrar operador' },
  cadastrando:           { pt: 'Cadastrando...',         en: 'Registering...',        es: 'Registrando...' },
  operadoresCadastrados: { pt: 'Operadores cadastrados', en: 'Registered operators',  es: 'Operadores registrados' },
  nenhumOperador:        { pt: 'Nenhum operador cadastrado.', en: 'No operators registered.', es: 'No hay operadores registrados.' },
  inativo:               { pt: 'inativo',                en: 'inactive',              es: 'inactivo' },
  minimoSenha:           { pt: 'Mínimo 6 caracteres',    en: 'Minimum 6 characters',  es: 'Mínimo 6 caracteres' },
  operadorCadastrado:    { pt: 'cadastrado com sucesso!', en: 'registered successfully!', es: 'registrado con éxito!' },
  confirmarDeletarOp1:   { pt: 'Deletar o operador',     en: 'Delete operator',       es: '¿Eliminar el operador' },
  confirmarDeletarOp2:   { pt: 'Esta ação não pode ser desfeita.', en: 'This action cannot be undone.', es: 'Esta acción no se puede deshacer.' },

  // ── Presença e atendimento ─────────────────────────────────────────────────
  operadoresOnline:  { pt: 'online',              en: 'online',               es: 'en línea' },
  respondendoIA:     { pt: 'IA respondendo',      en: 'AI responding',        es: 'IA respondiendo' },
  atendidoPor:       { pt: 'Atendido por',        en: 'Handled by',           es: 'Atendido por' },
  aguardandoFila:    { pt: 'Aguardando operador', en: 'Waiting for operator', es: 'Esperando operador' },

  // ── Encerrar / Transferir ─────────────────────────────────────────────────
  encerrarConversa:       { pt: 'Encerrar',               en: 'Close',                  es: 'Cerrar' },
  confirmarEncerrar:      { pt: 'Encerrar esta conversa?', en: 'Close this conversation?', es: '¿Cerrar esta conversación?' },
  conversaEncerrada:      { pt: 'Conversa encerrada',     en: 'Conversation closed',    es: 'Conversación cerrada' },
  transferirConversa:     { pt: 'Transferir',             en: 'Transfer',               es: 'Transferir' },
  selecionarOperador:     { pt: 'Selecionar operador...',  en: 'Select operator...',     es: 'Seleccionar operador...' },
  confirmarTransferencia: { pt: 'Transferir para',        en: 'Transfer to',            es: 'Transferir a' },

  // ── Gestão de IA ───────────────────────────────────────────────────────────
  abaIA:               { pt: '🤖 Inteligência Artificial', en: '🤖 Artificial Intelligence', es: '🤖 Inteligencia Artificial' },
  iaAtiva:             { pt: 'IA Ativa',              en: 'AI Active',               es: 'IA Activa' },
  iaInativa:           { pt: 'IA Inativa',             en: 'AI Inactive',             es: 'IA Inactiva' },
  iaModoDistribuicao:  { pt: 'Modo de distribuição',  en: 'Distribution mode',       es: 'Modo de distribución' },
  iaModoIA:            { pt: 'Triagem por IA',         en: 'AI triage',               es: 'Triaje por IA' },
  iaModoIADesc:        { pt: 'A IA decide quando escalar para humano', en: 'AI decides when to escalate to human', es: 'La IA decide cuándo escalar a humano' },
  iaModoBalanceamento: { pt: 'Balanceamento automático', en: 'Auto-balancing',        es: 'Balanceo automático' },
  iaModoBalanceamentoDesc: { pt: 'Leads vão direto para o operador menos ocupado', en: 'Leads go directly to the least busy operator', es: 'Los leads van directo al operador menos ocupado' },
  iaModelo:            { pt: 'Modelo',                 en: 'Model',                   es: 'Modelo' },
  iaIdioma:            { pt: 'Idioma das respostas',   en: 'Response language',        es: 'Idioma de respuestas' },
  iaIdiomaAuto:        { pt: 'Automático (detecta do lead)', en: 'Auto (detects from lead)', es: 'Automático (detecta del lead)' },
  iaMaxRodadas:        { pt: 'Máx. rodadas antes de escalar', en: 'Max rounds before escalating', es: 'Máx. rondas antes de escalar' },
  iaMaxRodasDica:      { pt: 'Após N trocas sem resolução, a IA escala automaticamente.', en: 'After N exchanges without resolution, AI auto-escalates.', es: 'Después de N intercambios sin resolución, la IA escala automáticamente.' },
  iaPromptSistema:     { pt: 'Prompt do sistema',      en: 'System prompt',            es: 'Prompt del sistema' },
  iaPromptDica:        { pt: 'Define personalidade, regras e formato de resposta da IA.', en: 'Defines AI personality, rules and response format.', es: 'Define personalidad, reglas y formato de respuesta de la IA.' },
  iaCriterios:         { pt: 'Critérios de escalação automática', en: 'Auto-escalation criteria', es: 'Criterios de escalación automática' },
  iaCriteriosDica:     { pt: 'A IA escalará imediatamente ao detectar qualquer um destes termos.', en: 'AI escalates immediately upon detecting any of these terms.', es: 'La IA escala inmediatamente al detectar cualquiera de estos términos.' },
  iaCriterioAdd:       { pt: 'Ex: reclamação, reembolso...', en: 'E.g.: complaint, refund...', es: 'Ej: reclamo, reembolso...' },
  iaTesteAoVivo:       { pt: 'Teste ao vivo',           en: 'Live test',               es: 'Prueba en vivo' },
  iaTesteAviso:        { pt: '⚠ Usa o prompt do formulário atual, mesmo sem salvar.', en: '⚠ Uses current form prompt, even without saving.', es: '⚠ Usa el prompt del formulario actual, sin guardar.' },
  iaMensagemTeste:     { pt: 'Simule uma mensagem do lead...', en: 'Simulate a lead message...', es: 'Simule un mensaje del lead...' },
  iaTestar:            { pt: 'Testar',                  en: 'Test',                    es: 'Probar' },
  iaTestando:          { pt: 'Analisando...',            en: 'Analyzing...',            es: 'Analizando...' },
  iaResultado:         { pt: 'Resultado',                en: 'Result',                  es: 'Resultado' },
  iaAcaoResolver:      { pt: 'RESOLVER',                 en: 'RESOLVE',                 es: 'RESOLVER' },
  iaAcaoEscalar:       { pt: 'ESCALAR',                  en: 'ESCALATE',                es: 'ESCALAR' },
  iaSalvarConfig:      { pt: 'Salvar configuração',      en: 'Save configuration',      es: 'Guardar configuración' },
  iaSalvandoConfig:    { pt: 'Salvando...',              en: 'Saving...',               es: 'Guardando...' },
  iaSucessoConfig:     { pt: 'Salvo! Ativo em até 30s.',  en: 'Saved! Active within 30s.', es: '¡Guardado! Activo en 30s.' },
  iaCaracteres:        { pt: 'caracteres',               en: 'characters',              es: 'caracteres' },
  iaUltimaAtualizacao: { pt: 'Última atualização',       en: 'Last updated',            es: 'Última actualización' },
  iaPor:               { pt: 'por',                      en: 'by',                      es: 'por' },

  // ── Admin — configurações do cliente ──────────────────────────────────────
  abaConfiguracoes:          { pt: '⚙️ Configurações',              en: '⚙️ Settings',                   es: '⚙️ Configuración' },
  cfgTituloWhatsApp:         { pt: 'API do WhatsApp',               en: 'WhatsApp API',                  es: 'API de WhatsApp' },
  cfgDescWhatsApp:           { pt: 'Credenciais para envio e recebimento de mensagens via WhatsApp Business.', en: 'Credentials for sending and receiving messages via WhatsApp Business.', es: 'Credenciales para enviar y recibir mensajes vía WhatsApp Business.' },
  cfgWhatsappToken:          { pt: 'Token de acesso permanente',    en: 'Permanent access token',        es: 'Token de acceso permanente' },
  cfgPhoneNumberId:          { pt: 'Phone Number ID',               en: 'Phone Number ID',               es: 'Phone Number ID' },
  cfgAppSecret:              { pt: 'App Secret',                    en: 'App Secret',                    es: 'App Secret' },
  cfgVerifyToken:            { pt: 'Verify Token',                  en: 'Verify Token',                  es: 'Verify Token' },
  cfgWebhookUrl:             { pt: 'URL do Webhook',                en: 'Webhook URL',                   es: 'URL del Webhook' },
  cfgWebhookUrlDica:         { pt: 'Configure esta URL no painel do Meta Developer.', en: 'Set this URL in the Meta Developer dashboard.', es: 'Configura esta URL en el panel de Meta Developer.' },
  cfgTituloIA:               { pt: 'Chave de API — IA',             en: 'API Key — AI',                  es: 'Clave de API — IA' },
  cfgDescIA:                 { pt: 'Chave própria de IA (Anthropic, OpenAI etc.). Se vazio, usa a chave padrão da plataforma.', en: 'Your own AI API key (Anthropic, OpenAI, etc.). If empty, the platform default key is used.', es: 'Tu propia clave de API de IA (Anthropic, OpenAI, etc.). Si está vacío, se usa la clave predeterminada.' },
  cfgIaApiKey:               { pt: 'Chave de API',                  en: 'API Key',                       es: 'Clave de API' },
  cfgIaApiKeyPlaceholder:    { pt: 'sk-ant-... ou sk-... (deixe vazio para usar a da plataforma)', en: 'sk-ant-... or sk-... (leave empty to use platform key)', es: 'sk-ant-... o sk-... (dejar vacío para usar la de la plataforma)' },
  cfgSalvar:                 { pt: 'Salvar configurações',          en: 'Save settings',                 es: 'Guardar configuración' },
  cfgSalvando:               { pt: 'Salvando...',                   en: 'Saving...',                     es: 'Guardando...' },
  cfgSucesso:                { pt: 'Configurações salvas!',         en: 'Settings saved!',               es: '¡Configuración guardada!' },
  cfgCopiar:                 { pt: 'Copiar',                        en: 'Copy',                          es: 'Copiar' },
  cfgCopiado:                { pt: 'Copiado!',                      en: 'Copied!',                       es: '¡Copiado!' },
  cfgCampoSensivel:          { pt: 'Preencha apenas para alterar o valor atual.', en: 'Fill in only to change the current value.', es: 'Rellene solo para cambiar el valor actual.' },

  // ── Modal Enviar Link ──────────────────────────────────────────────────────
  enviarLinkTitulo:        { pt: 'Enviar Link de Registro',                    en: 'Send Registration Link',                      es: 'Enviar Enlace de Registro' },
  enviarLinkMsgLabel:      { pt: 'Mensagem de acompanhamento',                 en: 'Accompanying message',                        es: 'Mensaje de acompañamiento' },
  enviarLinkMsgOpcional:   { pt: '(opcional)',                                 en: '(optional)',                                  es: '(opcional)' },
  enviarLinkMsgPlaceholder:{ pt: 'Deixe em branco para enviar apenas o link', en: 'Leave blank to send only the link',           es: 'Deja en blanco para enviar solo el enlace' },
  enviarLinkLimpar:        { pt: 'Limpar mensagem (enviar só o link)',         en: 'Clear message (send link only)',              es: 'Borrar mensaje (enviar solo el enlace)' },
  enviarLinkPrevia:        { pt: 'Prévia da mensagem:',                        en: 'Message preview:',                            es: 'Vista previa del mensaje:' },
  enviarLinkSemUrl:        { pt: '⚠️ URL base não configurada. Peça ao administrador para configurar em Admin → Configurações.', en: '⚠️ Base URL not configured. Ask the admin to set it in Admin → Settings.', es: '⚠️ URL base no configurada. Pide al administrador que la configure en Admin → Configuración.' },
  enviarLinkEnviando:      { pt: 'Enviando...',                                en: 'Sending...',                                  es: 'Enviando...' },
  enviarLinkSucesso:       { pt: 'Link enviado com sucesso!',                  en: 'Link sent successfully!',                     es: '¡Enlace enviado con éxito!' },
  enviarLinkErroConexao:   { pt: 'Erro de conexão.',                           en: 'Connection error.',                           es: 'Error de conexión.' },
  cancelar:                { pt: 'Cancelar',                                   en: 'Cancel',                                      es: 'Cancelar' },

  // ── Minhas Respostas — Meu Link ────────────────────────────────────────────
  meuLinkTitulo:           { pt: 'Meu Link de Registro',                       en: 'My Registration Link',                        es: 'Mi Enlace de Registro' },
  meuLinkDesc:             { pt: 'Seu link exclusivo gerado automaticamente. Ao clicar em "Enviar Link" no chat, esse link é enviado ao lead com a mensagem configurada abaixo.', en: 'Your automatically generated unique link. When clicking "Send Link" in chat, this link is sent to the lead with the message configured below.', es: 'Tu enlace exclusivo generado automáticamente. Al hacer clic en "Enviar enlace" en el chat, este enlace se envía al lead con el mensaje configurado abajo.' },
  meuLinkLabel:            { pt: 'Seu link exclusivo de afiliado',              en: 'Your exclusive affiliate link',               es: 'Tu enlace exclusivo de afiliado' },
  meuLinkSemUrl:           { pt: '(URL base não configurada pelo admin)',        en: '(Base URL not configured by admin)',           es: '(URL base no configurada por el admin)' },
  meuLinkCodigo:           { pt: 'Seu código de rastreamento:',                 en: 'Your tracking code:',                         es: 'Tu código de rastreo:' },
  meuLinkMsgLabel:         { pt: 'Mensagem padrão ao enviar o link',            en: 'Default message when sending the link',       es: 'Mensaje predeterminado al enviar el enlace' },
  meuLinkMsgPlaceholder:   { pt: 'Ex: Olá! Acesse o link abaixo para se registrar:', en: 'E.g.: Hello! Access the link below to register:', es: 'Ej: ¡Hola! Accede al enlace de abajo para registrarte:' },
  meuLinkMsgDica:          { pt: 'Essa mensagem será pré-preenchida no modal ao clicar "Enviar Link". Deixe vazio para enviar só o link.', en: 'This message will be pre-filled in the modal when clicking "Send Link". Leave empty to send only the link.', es: 'Este mensaje se rellenará previamente en el modal al hacer clic en "Enviar enlace". Déjalo vacío para enviar solo el enlace.' },
  meuLinkSalvar:           { pt: 'Salvar',                                      en: 'Save',                                        es: 'Guardar' },
  meuLinkSalvando:         { pt: 'Salvando...',                                 en: 'Saving...',                                   es: 'Guardando...' },
  meuLinkSalvo:            { pt: 'Salvo!',                                      en: 'Saved!',                                      es: '¡Guardado!' },
  meuLinkErro:             { pt: 'Erro ao salvar.',                             en: 'Error saving.',                               es: 'Error al guardar.' },

  // ── Compartilhado ──────────────────────────────────────────────────────────
  erroDesconhecido: { pt: 'Erro desconhecido.', en: 'Unknown error.', es: 'Error desconocido.' },
}
