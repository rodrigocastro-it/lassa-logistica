-- Banco próprio do sistema de logística (PostgreSQL).
-- Não confundir com o banco do WiBi: aqui só ficam dados gerados pelo
-- app (login de motorista, status de entrega, paradas). Os dados de
-- carga/cliente/endereço continuam vindo do WiBi em tempo real (leitura).

CREATE TABLE IF NOT EXISTS motoristas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    senha_hash VARCHAR(200) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uma "carga" aqui é o registro local de que um motorista carregou uma
-- carga do WiBi (identificada por wibi_ca_id = t_carga.ca_id) no app.
CREATE TABLE IF NOT EXISTS cargas (
    id SERIAL PRIMARY KEY,
    wibi_ca_id INTEGER NOT NULL UNIQUE,
    data_entrega DATE,
    veiculo_placa VARCHAR(10),
    motorista_id INTEGER REFERENCES motoristas(id),
    status VARCHAR(20) NOT NULL DEFAULT 'aberta', -- aberta | em_rota | finalizada
    origem_lat NUMERIC(10,7),
    origem_lng NUMERIC(10,7),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uma parada = um cliente (venda) dentro da carga, na ordem otimizada.
CREATE TABLE IF NOT EXISTS paradas (
    id SERIAL PRIMARY KEY,
    carga_id INTEGER NOT NULL REFERENCES cargas(id) ON DELETE CASCADE,
    wibi_vd_codigo INTEGER NOT NULL,
    wibi_cl_codigo INTEGER NOT NULL,
    sequencia INTEGER NOT NULL,
    cliente_nome VARCHAR(150),
    cliente_endereco VARCHAR(500),
    cliente_telefone VARCHAR(30),
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    status VARCHAR(20) NOT NULL DEFAULT 'pendente', -- pendente | chegada | inicio | fim | problema
    chegada_em TIMESTAMPTZ,
    inicio_em TIMESTAMPTZ,
    fim_em TIMESTAMPTZ,
    problema_descricao TEXT,
    problema_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (carga_id, wibi_vd_codigo)
);

-- Paradas manuais/avulsas do motorista (almoço, abastecimento etc. — Fase 4).
CREATE TABLE IF NOT EXISTS paradas_manuais (
    id SERIAL PRIMARY KEY,
    carga_id INTEGER NOT NULL REFERENCES cargas(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    inicio_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    fim_em TIMESTAMPTZ,
    observacao VARCHAR(300)
);

CREATE INDEX IF NOT EXISTS idx_paradas_carga_id ON paradas(carga_id);
CREATE INDEX IF NOT EXISTS idx_cargas_motorista_id ON cargas(motorista_id);
