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

**Bug corrigido em 2026-10-21:** o Rodrigo avaliou uma carga real e todas
as cidades vieram "Não bate" — até cidades de rotas já consolidadas e
lucrativas (ex: Camocim, Senador Sá/Uruoca/Martinópole/Granja). Causa: o
WiBi trata cada distrito/localidade como uma "cidade" separada (ex:
"Maceió (Camocim)", "Barroquinha", "Chaval" aparecem como três cidades
diferentes), e a avaliação julgava cada uma isoladamente contra o mínimo
da rota inteira, em vez de somar todas as localidades da mesma rota antes
de comparar. Corrigido: `avaliarPorCidade` agora identifica a qual rota
cadastrada cada localidade pertence (`identificarRotaPorNome`, nova
função) e agrupa por rota antes de julgar "bate"/"não bate" — localidades
sem rota cadastrada continuam avaliadas sozinhas pelo cálculo de
distância, como antes. Também corrigido um bug de correspondência: o WiBi
usa o formato "X (Y)" (Y = município oficial da localidade X), e a busca
antiga não lidava com esse sufixo — agora `rotasConhecidasService` separa
core/parent do nome e tenta o município (mais confiável) antes do nome da
localidade. De quebra, corrigida uma digitação minha: `'Santa Tereziinha'`
→ `'Santa Terezinha'` (migração 008), pra bater com o nome real do WiBi.
Validado rodando os dois clusters reais que o Rodrigo mandou (Camocim:
R$11.921,55 contra mínimo R$10.000 = bate; Senador Sá/Uruoca/Martinópole/
Granja: R$11.393,55 contra R$8.000 = bate; Massapê sozinho: R$255,60
contra R$5.000 = não bate, como esperado) contra Postgres local antes de
subir.

**Refinado em 2026-10-21, segunda rodada:** mesmo com o agrupamento por
rota corrigido, a Erileila apontou que juntar TUDO da rota e comparar
contra o mínimo da rota inteira também está errado -- tem distritozinho
pequeno que, sozinho, não justifica o desvio que o caminhão precisa fazer
pra chegar lá, mesmo que o resto da rota compense. Ela foi clara: "se a
gente colocar tudo junto o valor vai dar, mas quando a gente separa, não
vale a pena o carro ir" -- e também que uma cidade pode ser "passagem"
(no caminho, desvio praticamente zero, ex: Massapê indo pra Camocim) ou
um desvio de verdade que precisa ser julgado sozinho.

Implementado: dentro de uma rota, a cidade-sede (nome sem parênteses, ex:
"Camocim", "Barroquinha") sempre entra na conta -- é parada obrigatória.
Já os distritos (formato "X (Y)" do WiBi, ex: "Maceió (Camocim)") são
testados um a um: monta a cadeia Sobral → cidades-sede em sequência
(mesma otimização usada pra montar rota de verdade, `routeOptimizer.
otimizarSequencia`) → Sobral, e calcula o desvio de inserir cada distrito
no trecho mais barato dessa cadeia (`dist(A,distrito)+dist(distrito,B)-
dist(A,B)`, a mesma fórmula de desvio já confirmada lá no Passo 3). O
mínimo desse distrito é só o custo do desvio (sem o fator ida-e-volta,
que é só pra viagem dedicada) -- se o valor dele não cobrir, ele é
cortado da carga e aparece como item separado na tela (a venda não some,
só não compensa ir buscar agora). Se a rota não tiver nenhuma cidade-sede
com coordenada (só distritos, sem nenhum ponto de referência pra montar a
cadeia), cai no comportamento anterior (todo mundo somado contra o
mínimo da rota, sem teste de desvio individual) -- não dá pra montar
cadeia sem inventar sequência.

Também corrigido, durante os testes, um bug onde o ponto geográfico de
cada cidade calculado (`ponto`) não estava sendo guardado no objeto da
localidade -- fazia o teste de desvio nunca rodar de verdade (sempre
caía como "sem coordenada"), mascarado porque o resultado final parecia
certo mesmo assim nos casos testados antes.

Validado com cenários sintéticos (coordenadas aproximadas, só pra testar
a lógica) contra Postgres local: distrito perto da rota principal (ex:
"Mucambo (Chaval)" a 0,09km de desvio) é incluído de graça; distrito
simulado bem longe do caminho (350km de desvio) é cortado corretamente e
aparece como item isolado "não compensa o desvio". Falta validar com
coordenadas/GPS reais de clientes quando a próxima carga real for
avaliada.

**Ainda não resolvido (fora do escopo de hoje, avisado ao Rodrigo):** o
caso de uma localidade de uma rota "pegar carona" no caminho de OUTRA
rota (ex: Massapê, que é uma rota própria com mínimo R$5.000, mas fica no
caminho físico pra Camocim) -- hoje cada rota nomeada ainda é agrupada e
avaliada isoladamente das outras. Resolver isso exigiria cruzar rotas
diferentes geograficamente, o que é uma mudança maior; fica pra uma
próxima rodada se a Erileila confirmar que isso acontece com frequência
suficiente pra valer a pena.

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

## Indicadores de Entrega (reunião semanal, pedido da Zuleika em 2026-11-11)

A Zuleika (alinhada com a Roberta) pediu uma reunião semanal de
acompanhamento de entregas, com: rota (cidades), placa, motorista, dia/hora
programado e real de saída, km da saída, pedidos (notas), ocorrências,
dia/hora programado e real de chegada, se voltou com pedido não entregue.

Confirmado com o Rodrigo em 2026-11-13 (sem adivinhar processo):
- O horário/dia **programado** é digitado por quem monta a carga
  (Jacineuda/Nina) -- novos campos `programado_saida_em` /
  `programado_chegada_em` em `cargas`, editáveis a qualquer momento via
  `PATCH /dashboard/rotas/:id/programado` (tela: `DashboardRotaDetalhe`).
- "Km da saída" é o **hodômetro do caminhão**, digitado pelo motorista
  (não dá pra capturar automaticamente) -- novo campo
  `saida_hodometro_km`. O app do motorista agora pede essa leitura antes
  de mostrar a rota, toda vez que uma carga ainda não tem `saida_em`
  registrado (`PATCH /cargas/:id/saida`, idempotente via COALESCE pra não
  sobrescrever se reabrir o app).
- "Se voltou com pedido" é um status **novo e separado** de "problema":
  problema = ocorrência durante a entrega (ex: trânsito, atraso); não
  entregue = o pedido simplesmente não foi deixado e voltou no caminhão.
  Novo status `nao_entregue` em `paradas` (com `nao_entregue_motivo` e
  `nao_entregue_em`), com botão próprio no app do motorista
  (`DetalheCliente`), separado do botão "Problema".

Migração: `010_indicadores_entrega.sql`.

Implementado:
- `retorno_em` em `cargas`, gravado automaticamente ao finalizar a rota
  (`PATCH /cargas/:id/finalizar`) -- é a chegada real de volta na empresa,
  diferente da chegada no último cliente.
- `GET /dashboard/indicadores?inicio=&fim=` -- uma linha por carga no
  período, com tudo acima agregado (pedidos, ocorrências, não entregues).
  As cidades da rota vêm do WiBi (mesmo serviço do Planejamento de Carga,
  `wibiCargaService.getCargaParaAvaliacao`) -- se o WiBi falhar pra uma
  carga específica, ela ainda aparece no relatório, só sem a lista de
  cidades (best-effort).
- `GET /dashboard/indicadores/exportar` -- CSV pra levar pra reunião
  (Excel/Google Sheets), mesmo padrão do exportar de rota que já existia.
- Tela nova `/dashboard/indicadores` com filtro de período e os mesmos
  números, pra consulta rápida sem precisar abrir o CSV.

Testado contra Postgres local (migração + query de agregação com dados
sintéticos) e o servidor real subindo sem erro antes de ir pro ar.

**Ainda não resolvido:** a torre de controle hoje só define o programado
depois que a carga já foi montada (na tela de detalhe) -- não dá pra
definir programado ANTES de montar a carga no WiBi, porque a carga local
só existe depois de montada. Se isso for um problema na prática, pode
precisar de uma tabela de "programação" separada da carga em si.

## Devoluções (torre de controle), pedido do Rodrigo em 2026-11-13

A Nina (supervisora da logística) já mantinha um controle de devoluções
num caderninho e numa planilha (que ela ia atualizando e mandando no
grupo do WhatsApp) -- colunas ROTA, QUANTIDADE, VALOR, MOTIVO, por período
(ex: "29/06 à 04/07"). O Rodrigo pediu pra trazer isso pro sistema: a
torre de controle também poder registrar devolução, como reforço de
quando o motorista esquecer de marcar no app -- mas a obrigação de marcar
continua sendo do motorista, a Nina só supervisiona/confere.

Decisão de design: em vez de criar um registro solto desconectado dos
dados reais (ex: uma tabela de texto livre tipo a planilha), reaproveitei
o mesmo status `nao_entregue` já implementado nas paradas (pedido da
Zuleika, ver seção acima) -- a torre agora também pode marcar uma parada
existente como "não entregue" (`PATCH /dashboard/paradas/:id/nao-entregue`,
botão na tela de detalhe da rota). Isso mantém uma fonte única de verdade
(a mesma parada/venda real), em vez de duplicar informação numa planilha
paralela.

O relatório (`GET /dashboard/devolucoes`, + `/exportar` em CSV, tela
`/dashboard/devolucoes`) agrupa automaticamente as paradas "não entregue"
por **rota** (não por cidade/distrito isolado -- reaproveita
`identificarRotaPorNome`, o mesmo matching usado no Planejamento de
Carga), somando quantidade e valor (puxado do WiBi, `vd_valortotal`) e
listando os motivos -- no mesmo formato da planilha da Nina, só que
calculado automaticamente a partir do que já está registrado, sem
precisar compilar à mão.

Testado com dados sintéticos (stub do WiBi) contra Postgres local: bateu
exatamente o formato/valores da planilha real da Nina (ex: Santana R$152
"CLIENTE FECHADO", Massapê R$221,20 "CLIENTE NÃO FOI BUSCAR").

**Ainda não resolvido:** se uma devolução não tiver nenhuma venda
associada no WiBi que bata com a localidade (ex: pedido duplicado que não
é bem uma "devolução de produto"), ela cai em "Sem cidade identificada"
-- não tentei adivinhar categoria nenhuma pra esses casos.
