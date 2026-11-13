-- Indicadores pra reunião semanal de acompanhamento de entregas (pedido
-- da Zuleika em 2026-11-11, alinhado com a Roberta). Campos confirmados
-- com o Rodrigo em 2026-11-13:
-- - "programado" é digitado por quem monta a carga (Jacineuda/Nina).
-- - "km da saída" é o hodômetro do caminhão, digitado pelo motorista
--   (não dá pra capturar isso automaticamente).
-- - "voltou com pedido" é um status novo e separado de "problema" --
--   problema é uma ocorrência durante a entrega, não entregue é o pedido
--   que simplesmente não foi deixado e voltou no caminhão.

ALTER TABLE cargas ADD COLUMN IF NOT EXISTS programado_saida_em TIMESTAMPTZ;
ALTER TABLE cargas ADD COLUMN IF NOT EXISTS programado_chegada_em TIMESTAMPTZ;
ALTER TABLE cargas ADD COLUMN IF NOT EXISTS saida_em TIMESTAMPTZ;
ALTER TABLE cargas ADD COLUMN IF NOT EXISTS saida_hodometro_km NUMERIC(10,1);
ALTER TABLE cargas ADD COLUMN IF NOT EXISTS retorno_em TIMESTAMPTZ;

ALTER TABLE paradas ADD COLUMN IF NOT EXISTS nao_entregue_em TIMESTAMPTZ;
ALTER TABLE paradas ADD COLUMN IF NOT EXISTS nao_entregue_motivo TEXT;
