-- Correção: "Barroquinha + Chaval" e "Barroquinha + Chaval + Bitupitá"
-- nunca tiveram valor confirmado de verdade -- na foto original da folha
-- de rotas, o número impresso dessas duas linhas está encoberto e, ao
-- contrário de toda outra linha da planilha, não tem o valor confirmado
-- escrito à mão do lado. R$1.000 e R$4.000 foram um erro de transcrição
-- meu, não um dado real. A Erileila corrigiu em 2026-10-21: o mínimo de
-- Barroquinha + Chaval, saindo de Camocim, é R$5.700,00.
UPDATE rotas_combinacoes
SET minimo = 5700
WHERE descricao = 'Barroquinha + Chaval';

-- "Barroquinha + Chaval + Bitupitá" segue sem confirmação real -- remove
-- o valor inventado em vez de manter um número errado. Enquanto não vier
-- confirmação, essa combinação cai no mínimo base da rota Camocim
-- (R$10.000, já confirmado).
DELETE FROM rotas_combinacoes
WHERE descricao = 'Barroquinha + Chaval + Bitupitá';
