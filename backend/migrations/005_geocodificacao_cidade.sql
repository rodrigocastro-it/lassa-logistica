-- Cache de geocodificação de cidade (nome -> lat/lng), usado quando nenhum
-- cliente de um grupo tem GPS cadastrado no WiBi. Evita bater no serviço de
-- geocodificação (Nominatim/OpenStreetMap, gratuito) toda vez pra mesma
-- cidade.
CREATE TABLE IF NOT EXISTS cidades_geocodificadas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    uf VARCHAR(10),
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    encontrado BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (nome, uf)
);
