-- Planejamento de carga: configuração de custo/margem usada pra calcular o
-- valor mínimo de uma entrega valer a pena, e o cronograma de qual região
-- entrega em qual dia da semana (definido com a diretoria, não existe no
-- WiBi). Confirmado com o Rodrigo em 2026-10-17.

CREATE TABLE IF NOT EXISTS config_custo_logistico (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    custo_km_caminhao NUMERIC(10,2) NOT NULL DEFAULT 5,
    fator_ida_volta NUMERIC(5,2) NOT NULL DEFAULT 2,
    margem_multiplicador NUMERIC(5,2) NOT NULL DEFAULT 10,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT config_custo_logistico_singleton CHECK (id = 1)
);

INSERT INTO config_custo_logistico (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS regioes_cronograma (
    id SERIAL PRIMARY KEY,
    nome_regiao VARCHAR(120) NOT NULL,
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo .. 6=sábado
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
