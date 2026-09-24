-- GPS real capturado no momento da chegada (via Point Track, pela placa do
-- veículo), pra comparar com o GPS cadastrado do cliente (latitude/longitude
-- já existentes) e alimentar a correção do cadastro no WiBi.
ALTER TABLE paradas ADD COLUMN IF NOT EXISTS chegada_lat NUMERIC(10,7);
ALTER TABLE paradas ADD COLUMN IF NOT EXISTS chegada_lng NUMERIC(10,7);
