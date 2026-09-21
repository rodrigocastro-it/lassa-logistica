-- Distância total estimada da rota (ida pelas paradas + volta à origem),
-- calculada pelo otimizador no momento em que a carga é carregada.
ALTER TABLE cargas ADD COLUMN IF NOT EXISTS distancia_total_km NUMERIC(10,2);
