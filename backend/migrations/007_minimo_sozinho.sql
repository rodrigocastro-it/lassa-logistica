-- Algumas paradas têm um mínimo diferente dependendo se a entrega é avulsa
-- (viagem dedicada só pra lá) ou se "pega carona" numa rota que já vai
-- passar por perto. Confirmado com o Rodrigo em 2026-10-18: Bilheira
-- sozinha = R$4.400 (viagem dedicada); junto com a rota Taperuaba = R$1.000
-- (ela só precisa somar isso a mais, o resto do custo já é coberto pela
-- rota).
ALTER TABLE rotas_paradas_minimas ADD COLUMN IF NOT EXISTS minimo_sozinho NUMERIC(10,2);

COMMENT ON COLUMN rotas_paradas_minimas.minimo IS 'Mínimo quando a parada vai junto com o resto da rota (caso mais comum)';
COMMENT ON COLUMN rotas_paradas_minimas.minimo_sozinho IS 'Mínimo quando é uma viagem dedicada só pra essa parada, sem o resto da rota';

UPDATE rotas_paradas_minimas
SET minimo_sozinho = 4400, observacao = 'R$1.000 se for junto com a rota Taperuaba; R$4.400 se for entrega avulsa, só pra lá'
WHERE nome_parada = 'Bilheira';
