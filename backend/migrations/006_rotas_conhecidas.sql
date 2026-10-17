-- Mínimos de entrega reais, pré-definidos com a diretoria (passados pelo
-- Rodrigo em 2026-10-17/18, a partir da folha de rotas impressa que a
-- empresa já usa). Isso é o valor de verdade pra cada rota/parada -- tem
-- prioridade sobre o cálculo por distância (que é só uma estimativa
-- genérica usada quando não existe um valor real cadastrado aqui).
CREATE TABLE IF NOT EXISTS rotas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(160) NOT NULL,
    minimo_base NUMERIC(10,2),
    minimo_flexivel NUMERIC(10,2), -- "pode ser a partir de" (piso mais baixo, aceitável)
    observacao TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Combinação de paradas dentro de uma rota, com mínimo próprio (ex:
-- "Itapipoca + Miraíma" = R$9.000, mas incluindo Amontada vira R$11.800).
CREATE TABLE IF NOT EXISTS rotas_combinacoes (
    id SERIAL PRIMARY KEY,
    rota_id INTEGER NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
    descricao VARCHAR(255) NOT NULL,
    minimo NUMERIC(10,2) NOT NULL
);

-- Parada individual dentro de uma rota com valor mínimo próprio (ex:
-- "Tangente" dentro da rota Massapê = R$1.400).
CREATE TABLE IF NOT EXISTS rotas_paradas_minimas (
    id SERIAL PRIMARY KEY,
    rota_id INTEGER NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
    nome_parada VARCHAR(160) NOT NULL,
    minimo NUMERIC(10,2) NOT NULL,
    observacao TEXT
);

-- Seed com o que já foi confirmado em 2026-10-17/18.

INSERT INTO rotas (nome, minimo_base, minimo_flexivel) VALUES
    ('Massapê', 5000, 2000),
    ('Itapipoca', 9000, NULL),
    ('Meruoca/Alcântaras', 4500, NULL),
    ('Santana', 5000, 3700),
    ('Marco/Bela Cruz/Cruz', 10000, NULL),
    ('Tianguá/Frecheirinha/Ubaúna', 8000, NULL),
    ('Morrinhos/Itarema/Acaraú', 14000, NULL),
    ('Groaíras/Cariré', 3600, NULL),
    ('Ubajara/Ibiapina/São Benedito/Carnaubal/Guaraciaba', 14100, NULL),
    ('Senador Sá/Uruoca/Martinópole/Granja', 8000, NULL),
    ('Camocim', 10000, NULL),
    ('Forquilha', 5000, 2500),
    ('Taperuaba', 5500, NULL),
    ('Distritos de Sobral', NULL, NULL);

INSERT INTO rotas_combinacoes (rota_id, descricao, minimo)
SELECT id, v.descricao, v.minimo FROM rotas, (VALUES
    ('Itapipoca + Miraíma', 9000),
    ('Itapipoca + Miraíma + Amontada', 11800),
    ('Meruoca + Alcântaras + Coreaú + Aroeiras', 7000),
    ('Meruoca + Alcântaras + Coreaú + Aroeiras + Moraújo + Campanário', 9500),
    ('Marco + Bela Cruz + Cruz + Jijoca + Preá + Aranaú', 14000),
    ('Groaíras + Cariré + Mucambo + Pacujá', 7600),
    ('Groaíras + Cariré + Mucambo + Pacujá + Graça', 8600),
    ('Groaíras + Cariré + Mucambo + Pacujá + Graça + Reriutaba + Varjota', 13000),
    ('Groaíras + Cariré + Mucambo + Pacujá + Graça + Reriutaba + Varjota + Pires Ferreira + Ipu', 16280),
    ('Groaíras + Cariré + Mucambo + Pacujá + Graça + Reriutaba + Varjota + Pires Ferreira + Ipu + Ipueiras', 18360),
    ('Barroquinha + Chaval', 1000),
    ('Barroquinha + Chaval + Bitupitá', 4000),
    ('Bonfim + Jaibaras + Aprazível', 3000),
    ('Bonfim + Jaibaras + Aprazível + São José + Torto + Rafael Arruda', 5000)
) AS v(descricao, minimo)
WHERE rotas.nome = (CASE
    WHEN v.descricao LIKE 'Itapipoca%' THEN 'Itapipoca'
    WHEN v.descricao LIKE 'Meruoca%' THEN 'Meruoca/Alcântaras'
    WHEN v.descricao LIKE 'Marco%' THEN 'Marco/Bela Cruz/Cruz'
    WHEN v.descricao LIKE 'Groaíras%' THEN 'Groaíras/Cariré'
    WHEN v.descricao LIKE 'Barroquinha%' THEN 'Camocim'
    WHEN v.descricao LIKE 'Bonfim%' THEN 'Distritos de Sobral'
END);

INSERT INTO rotas_paradas_minimas (rota_id, nome_parada, minimo, observacao)
SELECT id, v.nome_parada, v.minimo, v.observacao FROM rotas, (VALUES
    ('Massapê', 'Tangente', 1400, NULL),
    ('Massapê', 'Ipaguaçu', 800, NULL),
    ('Santana', 'Parapuí', 1500, NULL),
    ('Tianguá/Frecheirinha/Ubaúna', 'Viçosa', 3000, 'valor mínimo'),
    ('Morrinhos/Itarema/Acaraú', 'Sítio Alegre', 2000, 'apelido: Capivarinha'),
    ('Morrinhos/Itarema/Acaraú', 'Curral Velho', 1000, NULL),
    ('Morrinhos/Itarema/Acaraú', 'Gorgoê', 300, NULL),
    ('Morrinhos/Itarema/Acaraú', 'Almofala', 1000, NULL),
    ('Morrinhos/Itarema/Acaraú', 'Morada Nova', 300, NULL),
    ('Morrinhos/Itarema/Acaraú', 'Juritianha', 1300, NULL),
    ('Morrinhos/Itarema/Acaraú', 'Parapuí', 1000, NULL),
    ('Senador Sá/Uruoca/Martinópole/Granja', 'Parazinho', 3000, NULL),
    ('Senador Sá/Uruoca/Martinópole/Granja', 'Pitimbu', 4000, NULL),
    ('Senador Sá/Uruoca/Martinópole/Granja', 'Santa Tereziinha', 3000, NULL),
    ('Senador Sá/Uruoca/Martinópole/Granja', 'Timonha', 4000, NULL),
    ('Camocim', 'Maceió', 1500, NULL),
    ('Forquilha', 'Taperuaba', 4000, NULL),
    ('Taperuaba', 'Bilheira', 1000, 'conflito a confirmar: anotação separada diz "Somente Bilheira - R$4.400,00"'),
    ('Distritos de Sobral', 'Jordão', 2000, NULL),
    ('Distritos de Sobral', 'Aprazível', 2000, NULL),
    ('Distritos de Sobral', 'Bonfim + Jaibaras', 2300, NULL)
) AS v(rota_nome, nome_parada, minimo, observacao)
WHERE rotas.nome = v.rota_nome;
