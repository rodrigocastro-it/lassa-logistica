-- Correção de digitação: a planilha original diz "Santa Terezinha", eu
-- transcrevi errado como "Santa Tereziinha" na migração 006. O WiBi
-- confirma o nome real ("Santa Terezinha (Granja)"), então corrige aqui
-- pra bater com o cadastro de minimos.
UPDATE rotas_paradas_minimas
SET nome_parada = 'Santa Terezinha'
WHERE nome_parada = 'Santa Tereziinha';
