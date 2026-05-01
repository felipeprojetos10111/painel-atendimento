-- Migração: tabela de sessões de presença dos operadores
CREATE TABLE IF NOT EXISTS sessoes_presenca (
  id          SERIAL PRIMARY KEY,
  operador_id INT NOT NULL,
  cliente_id  INT NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'ativo',
  inicio      TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  fim         TIMESTAMP(6),
  duracao_min INT,
  CONSTRAINT fk_sessoes_operador FOREIGN KEY (operador_id) REFERENCES operadores(id) ON DELETE CASCADE,
  CONSTRAINT fk_sessoes_cliente  FOREIGN KEY (cliente_id)  REFERENCES clientes(id)   ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessoes_presenca_operador ON sessoes_presenca(operador_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_presenca_cliente  ON sessoes_presenca(cliente_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_presenca_fim      ON sessoes_presenca(fim) WHERE fim IS NULL;
