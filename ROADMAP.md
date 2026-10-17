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

## Passo 2 — decidir o que vale a pena entregar e montar a carga (iniciado em 2026-10-17)

A dor real (relatada pelo Rodrigo em 2026-10-17): todo dia a Jacineuda monta
carga por cidade/região, mas trava pra saber se o total daquela região
atingiu o "mínimo" que compensa o custo da viagem. Isso vira uma cadeia de
mensagens no WhatsApp (Jacineuda → Erileila → Rodrigo decide → Jacineuda
ajusta) que atrasa todo mundo, incluindo a Nina esperando pra imprimir o
roteiro. A Roberta por sua vez questiona exclusões cliente a cliente, porque
não leva o custo logístico em conta.

Fórmula confirmada pelo Rodrigo (é a mesma conta que a Erileila faz hoje de
cabeça, só que sem calculadora):

```
mínimo = distância até o cliente (km, só ida) × fator_ida_volta × custo_km_caminhao × margem_multiplicador
```

Exemplo dado: 15km × 2 × 5 × 10 = R$ 1.500.

Confirmado também: o custo por km (`custo_km_caminhao`) e a margem são
fixos pra qualquer caminhão/região — não variam por tipo de veículo (pode
ser questionado no futuro, mas hoje é assim que a diretoria calcula).

Desvio de rota confirmado com exemplo real: saindo de Sobral pra entregar
Miraíma e Itapipoca (rota de ~100km), surgiu uma entrega em Amontada no
meio do caminho — a rota virou Sobral → Miraíma → Amontada → Itapipoca,
com +17km no total. Esse é exatamente o caso que `calcularCustoDesvio`
calcula (inserir B entre A e C). Existe um caso raro, ainda não tratado,
de desvio "sem saída" (A → B → volta pra A → C, quando B não conecta com
o próximo ponto) — combinado que não vale a pena complicar o modelo por
causa disso agora, é raro demais.

Implementado (nova aba "Planejamento de Carga", separada do acompanhamento
de entregas, em `/dashboard/planejamento`):
- `config_custo_logistico` (tabela, singleton): guarda `custo_km_caminhao`,
  `fator_ida_volta`, `margem_multiplicador` editáveis pela torre de
  controle, sem precisar mexer em código se a diretoria mudar os valores.
- `regioes_cronograma` (tabela): cadastro de qual cidade/região entrega em
  qual dia da semana — isso não existe no WiBi, é definido com a diretoria.
- Calculadora manual: informa a distância (ou lat/lng), mostra o mínimo, e
  compara com o valor total informado da região/carga.
- `calcularCustoDesvio` (backend, `custoLogisticoService.js`): fórmula de
  inserção de rota (dist(A,B) + dist(B,C) - dist(A,C)) pra calcular quanto
  custa a mais incluir uma parada que não estava na rota original — ainda
  não exposta na tela, só a API.

**Confirmado em 2026-10-17** (consulta em `INFORMATION_SCHEMA.COLUMNS`):
- Valor da venda: `t_vendas.vd_valortotal`.
- Cidade do cliente: `t_enderecos.cd_id` → `t_cidades.cd_id` (nome em
  `t_cidades.cd_descricao`, UF em `t_cidades.uf_id`).

Implementado com isso: `GET /planejamento/avaliar-carga/:caId` (backend:
`wibiCargaService.getCargaParaAvaliacao` + `custoLogisticoService.avaliarPorCidade`).
Busca a carga pelo número, agrupa as vendas por cidade, soma
`vd_valortotal` de cada grupo, calcula a distância (centróide das
coordenadas do grupo até a origem da Lassa) e o mínimo pela fórmula — e
mostra "bate" ou "não bate, falta R$X" por cidade, direto na aba
Planejamento de Carga. Essa é a parte que resolve de fato a dor relatada
pelo Rodrigo (não é mais só uma calculadora manual).

Quando nenhum cliente de uma cidade tem GPS cadastrado no WiBi (acontece,
viu na prática com Santa Quitéria em 2026-10-17), o sistema geocodifica o
nome da cidade (Nominatim/OpenStreetMap, gratuito, mesmo serviço do mapa)
como aproximação do centro da cidade — marcado na tela como "GPS
aproximado" pra não passar como se fosse o endereço exato do cliente.
Resultado fica em cache (`cidades_geocodificadas`) pra não bater no
serviço de novo pra mesma cidade.

## Mínimos reais da empresa (importado em 2026-10-17/18)

O Rodrigo passou a folha de rotas que a empresa já usa na prática, com os
mínimos pré-definidos com a diretoria pra cada rota/cidade/distrito — isso
é informação real, não mais uma estimativa por distância. Gravado em três
tabelas novas: `rotas` (mínimo base de cada rota, e o "pode ser a partir
de" quando existe), `rotas_combinacoes` (mínimo de uma combinação
específica de cidades dentro da rota, ex: "Itapipoca + Miraíma +
Amontada" = R$11.800) e `rotas_paradas_minimas` (mínimo de uma parada
específica dentro da rota, ex: "Tangente" dentro de Massapê = R$1.400).

`rotasConhecidasService.buscarMinimoConhecido(nomeCidade)` procura nessa
ordem: parada específica → combinação que contenha o nome → mínimo base
da rota. Se achar, esse é o mínimo usado na avaliação (tem prioridade
sobre o cálculo por distância, que vira só um retrocesso genérico quando
não existe valor real cadastrado pra aquela cidade).

Testado rodando as migrações contra um Postgres local antes de ir pra
produção — bateu certinho com os valores confirmados.

**Resolvido em 2026-10-18:** Taperuaba/Bilheira não era conflito, eram
dois valores legítimos pro mesmo lugar, dependendo do contexto — mesma
lógica do cálculo de desvio (ver Passo 3): R$1.000 quando a entrega
"pega carona" numa carga que já inclui a rota Taperuaba, R$4.400 quando é
viagem dedicada só pra lá. Adicionada coluna `minimo_sozinho` em
`rotas_paradas_minimas`; `buscarMinimoConhecido(nome, {sozinho})` escolhe
o valor certo sozinho, baseado em a carga avaliada ter só essa cidade ou
vir acompanhada de outras da mesma rota. Testado de novo contra Postgres
local antes de subir.

**Pendências explícitas, não resolvidas ainda (não adivinhar):**
- Cronograma de dias (segunda folha, com motoristas e caminhões): ainda
  não gravado. A leitura por foto gerou dúvida (rotas que pegam mais de
  um dia, ex: Marco/Bela Cruz/Cruz/Jijoca/Preá/Aranaú = terça E quarta).
  Combinado que o Rodrigo manda uma versão mais simples (só rota → dia,
  sem motorista/caminhão) antes de implementar, pra não interpretar
  errado um cronograma real da empresa.

**Ainda não automatizado:**
1. Como saber quais vendas já lançadas ainda **não foram colocadas em
   nenhuma carga** (hoje precisa saber o número da carga de antemão,
   porque a Jacineuda já montou manualmente) — precisa confirmar o
   significado de `t_vendas.vd_status` ou achar o critério certo (ex:
   venda sem registro em `t_carga_vendas`), pra no futuro sugerir cargas
   inteiras a partir do zero, não só avaliar uma carga já montada.
2. Cruzar com `regioes_cronograma` (cronograma de dia da semana por
   região) — o Rodrigo vai passar essa tabela depois.

Só depois dessas duas confirmações dá pra montar a tela que lista
automaticamente "essas vendas pendentes, agrupadas por região, atingiram
ou não o mínimo" — hoje a calculadora já existe, falta ela ser alimentada
sozinha em vez de digitar os números na mão.

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
