# Lassa Logística

Sistema de controle de entregas/logística da Lassa Laticínios — app do motorista
(web responsivo) + dashboard da torre de controle. Roda em paralelo ao painel
comercial de BI (`lassa-painel-comercial-bd`), consultando o mesmo banco do
ERP WiBi **somente leitura**, com um banco próprio (PostgreSQL) para os dados
que o app gera (login de motorista, status de entrega, paradas).

## Regra fundamental do projeto

Nenhuma query, endpoint ou regra de negócio aqui foi inventada — todo o
mapeamento de tabelas do WiBi foi confirmado rodando SQL real contra o banco
de produção (ver histórico do chat que originou este repositório). Qualquer
tabela/coluna nova que precisar ser usada deve ser confirmada da mesma forma
antes de virar código: **nunca assumir nome de tabela/coluna ou formato de
resposta de API.**

## Cadeia de tabelas do WiBi (confirmada em 2026-09-20)

```
dbo.t_carga (ca_id = "Nº Carga" que aparece em TMS → Carga/Recarga)
 ├─ ve_codigo → dbo.t_veiculos → pm_codigo → dbo.t_patrimonio.pm_placa
 └─ dbo.t_carga_vendas (ca_id → vd_codigo)
       └─ dbo.t_vendas (vd_codigo → cl_codigo, vd_status, vd_data_entrega)
             └─ dbo.t_clientes (cl_codigo → en_codigo, cl_latitude/cl_longitude,
                                 cl_itin_entrega, cl_h_inicial/final_entrega)
                   ├─ dbo.t_entidades (en_codigo → nome, telefones)
                   └─ dbo.t_enderecos (en_codigo → endereço completo,
                                        ed_latitude/ed_longitude geocodados,
                                        ed_error indica problema de geocodificação)
```

Pontos ainda **não confirmados** (não usar sem validar antes):
- Significado exato dos códigos `t_carga.ca_status` (char) e `t_vendas.vd_status` (int).
- Tabela "oficial" de motorista do WiBi (`t_veiculos.mt_codigo`) — não usada aqui,
  pois o login do motorista é um cadastro próprio deste sistema.
- Coordenadas de origem (galpão/CD) para a otimização de rota — configurar em
  `LASSA_ORIGEM_LAT`/`LASSA_ORIGEM_LNG` no `.env` do backend.
- `import.Cad_Cliente` existe no banco mas está incompleta/desatualizada — **não
  usar essa tabela**, usar sempre `dbo.t_clientes` + `dbo.t_entidades` + `dbo.t_enderecos`.

## Point Track (rastreamento GPS)

Autenticação: `PUT /Rest2/login.json` com email/senha → retorna JWT (expira em
4h) e a lista `rastreados` (cada veículo com `id` = `rastreado_id` e
`veiculo.placa`, que casa com `t_patrimonio.pm_placa`).

Posicionamento: `GET/PUT /RestPosicionamento/getPosicionamentos.json` — campos
confirmados em `UltimosPosicionamento`: `rastreado_id`, `latitude`,
`longitude` (strings decimais), `transmissao_datahora`
("DD/MM/YYYY HH:mm:ss"), `velocidade`, `ignicao`, `motorista`, `direcao`, etc.
Ver manual `Integracao_pointTrack_V3.2.pdf` para os demais endpoints
(abastecimento, manutenções, serviços). A integração ainda não foi
implementada no código (Fase 2).

## Estrutura

```
backend/    Node/Express — API REST, consultas ao WiBi (mssql) e ao banco
            próprio (PostgreSQL)
frontend/   React + Vite + Tailwind — app do motorista e dashboard da torre
            de controle
```

## Rodando localmente

```bash
# Backend
cd backend
cp .env.example .env   # preencher credenciais do WiBi (read-only) e do Postgres
npm install
npm run migrate        # cria as tabelas no Postgres
node src/scripts/criarMotorista.js "Fulano da Silva" fulano senha123
npm start

# Frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Rodando com Docker

São **dois arquivos `.env` diferentes**: um na raiz (usado só pelo próprio
`docker-compose.yml` pra resolver variáveis como a senha do Postgres) e outro
em `backend/` (usado pela aplicação em tempo de execução). Repita os mesmos
valores de `PG_USER`/`PG_PASSWORD`/`PG_DATABASE` nos dois.

```bash
cp .env.example .env                   # preencher (raiz)
cp backend/.env.example backend/.env   # preencher (WiBi, Postgres, JWT...)
docker compose up --build -d
docker compose exec backend node src/db/migrate.js
docker compose exec backend node src/scripts/criarMotorista.js "Fulano" fulano senha123
```

- App do motorista: http://localhost:8081/login
- Dashboard torre de controle: http://localhost:8081/dashboard

## Fases do MVP

- **Fase 1** (neste repositório): login motorista + carregar rota por número
  de carga (direto do WiBi) + marcação de status por cliente + dashboard
  básico da torre de controle.
- **Fase 2**: integração Point Track (mapa/rastreamento ao vivo).
- **Fase 3**: otimização de rota automática (módulo já isolado em
  `backend/src/services/routeOptimizer.js`, nearest-neighbor) + importação de
  romaneio por arquivo.
- **Fase 4**: tela de paradas detalhada (já iniciada), mensagens, jornada do
  motorista.
