# Roadmap e decisões

Histórico das decisões de produto tomadas fora do código, pra não se perder
na conversa. Segue a mesma regra fundamental do README: nada aqui foi
assumido sem confirmação real com quem faz esse trabalho hoje (Nina, na
torre de controle, ou Jacineuda, no faturamento).

## Objetivo de longo prazo (definido em 2026-10-09)

A ideia combinada com o Rodrigo é expandir aos poucos, testando e validando
cada passo, até cobrir toda a parte de logística:

1. Puxar automaticamente as cargas do dia direto do WiBi.
2. Decidir automaticamente qual venda entra em qual carga.
3. Montar a melhor rota com base em horário/localização.

Sem pular pra frente: cada passo só começa depois do anterior estar
validado em uso real.

## Passo 1 — listar cargas automaticamente (feito, 2026-10-09 a 2026-10-13)

- Confirmado com a Nina o significado de `t_carga.ca_status`: `A` = aberta
  (ainda não despachada), `P` = em rota sendo entregue, `F` = finalizada.
- Confirmado que carga aberta pode ficar de um dia anterior (falta de
  mercadoria etc), por isso o filtro usa `ca_data_entrega <= data`, não `=`.
- Implementado: `GET /dashboard/cargas-wibi` (lista cargas abertas prontas
  pra montar) e `GET /dashboard/cargas-em-entrega` (lista cargas já em rota
  hoje, direto do WiBi, independente de ter sido carregada no nosso sistema
  ou ter motorista logado) — essa segunda resolve o pedido da Nina de não
  precisar mais perguntar pra Jacineuda ou abrir o WiBi só pra saber o que
  tá na rua.
- Validado em produção pela Nina.

## Passo 2 — decidir automaticamente qual venda vai em qual carga (não iniciado)

Decisão explícita: **não implementar ainda.** Automatizar isso hoje
significaria inventar regras de negócio que não existem documentadas em
lugar nenhum — quem decide isso hoje é a Jacineuda, manualmente, levando em
conta coisas como capacidade do veículo, região e prazo de entrega. Antes de
qualquer código aqui, precisa:

1. Entrevistar a Jacineuda pra capturar os critérios reais que ela usa.
2. Confirmar esses critérios com exemplos reais (não just perguntar "como
   você decide", e sim validar com casos concretos).

## Passo 3 — melhor rota (geografia real, não linha reta)

O otimizador atual (`backend/src/services/routeOptimizer.js`) usa
nearest-neighbor com distância em linha reta (Haversine), não rota real de
rua. Funciona pra ordenar paradas de forma razoável, mas não sabe de
mão-de-direção, sentido de via, nem calcula km/tempo reais de estrada.

### Avaliado e descartado por ora (2026-10-13): Google Maps Platform

O Rodrigo testou o assistente de IA embutido no Google Maps (Gemini) pra
montar itinerário e perguntou se dava pra integrar isso no app.

Conclusão:
- O assistente de chat do Maps não é um produto integrável — é um recurso
  de consumidor, não uma API.
- As APIs reais equivalentes (Routes API, Route Optimization API) resolvem
  o problema de verdade, incluindo rota real de rua e restrições de
  caminhão, mas **exigem cadastro de cartão de crédito** mesmo pra usar só
  a cota gratuita, com risco de cobrança automática se o uso passar do
  limite.
- Dado que o sistema inteiro foi construído até agora sem nenhum custo
  (OpenStreetMap, Leaflet), e o volume de cargas da Lassa é baixo, decidido
  **não integrar por enquanto**. Fica anotado como melhoria futura a
  avaliar com calma, não descartada de vez.
- Alternativa gratuita sem cartão, se um dia for necessária: self-hospedar
  o OSRM (motor de rotas open source) com um perfil de caminhão — mais
  trabalho técnico de infraestrutura, mas sem custo recorrente nem risco de
  cobrança surpresa.
