# Deploy no Lightsail (Ubuntu 22.04)

Mesma instância AWS Lightsail onde já está o painel comercial
(`lassa-painel-comercial-bd`, US$12/mês, 2GB RAM / 2 vCPUs / 60GB SSD,
Docker instalado via `get.docker.com`). Sem conflito de porta: o painel usa
`8787`/`8080`, este app usa `8788`/`8081`.

## 0. Antes de tudo: mede a memória livre

```bash
free -h
docker stats --no-stream
```

Com 2GB de RAM rodando Node+Nginx do painel comercial, ainda deve sobrar
espaço pra mais um Node+Nginx+Postgres pequenos, mas **fica de olho depois
de subir** (`docker stats`). Se apertar, dá pra:
- Trocar o Postgres por uma instância bem enxuta (já é `alpine`, ~50-80MB
  em uso normal com pouco dado);
- Ou migrar este app pra uma instância Lightsail separada (US$5-7/mês) —
  não muda nada no código, só onde ele roda.

## 1. Clonar o repositório

```bash
cd ~
git clone https://github.com/rodrigocastro-it/lassa-logistica
cd lassa-logistica
```

## 2. Criar os `.env` (dois arquivos, como no notebook)

```bash
cp .env.example .env
cp backend/.env.example backend/.env
nano .env               # PG_USER / PG_PASSWORD / PG_DATABASE — invente uma senha forte
nano backend/.env       # WiBi (read-only), Postgres (mesmos valores do .env acima), JWT_SECRET, Point Track
```

**Gere um `JWT_SECRET` forte de verdade agora** (isso vai pra produção, não é mais teste local):

```bash
openssl rand -hex 32
```

Cola o resultado em `JWT_SECRET=` no `backend/.env`.

## 3. Abrir as portas no firewall do Lightsail

No painel da AWS Lightsail → sua instância → aba **Networking** → **IPv4
Firewall** → adicione regras:
- `Custom TCP` porta `8081` (frontend)
- `Custom TCP` porta `8788` (backend)

(mesma lógica que vocês já devem ter feito pra `8080`/`8787` do painel
comercial)

## 4. Criar o Cloudflare Worker (HTTPS sem domínio, grátis)

No painel do Cloudflare (o mesmo onde está o Worker do painel comercial):
**Workers & Pages → Create → Create Worker**. Dê um nome, ex.
`lassa-rotas`, e cole este código (troque `SEU_IP_PUBLICO` pelo IP público
da instância Lightsail):

```js
const SERVER_IP = 'SEU_IP_PUBLICO';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const destino = url.pathname.startsWith('/api')
      ? `http://${SERVER_IP}:8788${url.pathname}${url.search}`
      : `http://${SERVER_IP}:8081${url.pathname}${url.search}`;

    const resposta = await fetch(destino, {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.blob()
    });

    return new Response(resposta.body, resposta);
  }
};
```

Clique em **Deploy**. Você recebe uma URL tipo
`https://lassa-rotas.SEUUSUARIO.workers.dev` — **essa é a URL pública com
HTTPS** que os motoristas vão usar no celular.

## 5. Buildar com a URL do Worker

Só agora, com a URL do Worker em mãos, edite o `.env` da raiz:

```bash
nano .env
```

```
VITE_API_BASE_URL=https://lassa-rotas.SEUUSUARIO.workers.dev/api
```

## 6. Subir os containers

```bash
docker compose up --build -d
docker compose ps        # confere se postgres/backend/frontend estão "Up"
docker compose exec backend node src/db/migrate.js
docker compose exec backend node src/scripts/criarMotorista.js "Nome Real" usuario_real senha_real
```

Crie uma conta por motorista de verdade (repete o último comando trocando
nome/usuário/senha).

## 7. Testar

- Motorista (celular ou navegador): `https://lassa-rotas.SEUUSUARIO.workers.dev`
- Dashboard torre de controle: `https://lassa-rotas.SEUUSUARIO.workers.dev/dashboard`

## 8. Comandos do dia a dia

```bash
docker compose logs -f backend      # logs em tempo real
docker compose down                 # parar tudo
docker compose up -d                # subir de novo (sem rebuildar)
git pull && docker compose up --build -d   # depois de eu mandar atualização
docker stats --no-stream            # checar uso de memória
```

## Sobre HTTPS via Worker vs domínio próprio

O Worker resolve o problema agora (grátis, sem esperar decisão da
diretoria sobre domínio), mas tem limitações que valem saber:
- O tráfego passa pela Cloudflare, que tem limites generosos no plano
  gratuito mas não ilimitados (não deve ser problema pro volume de uma
  frota, mas fica registrado).
- Se um dia a empresa tiver domínio próprio, o ideal é migrar pra ele com
  um proxy reverso de verdade (Nginx/Caddy) na própria instância + Let's
  Encrypt — mais controle, sem depender de terceiro no meio. Não é urgente
  agora, mas é a evolução natural.

## Segurança — antes de considerar "em produção pra valer"

- `JWT_SECRET` forte (feito no passo 2).
- Senhas de motorista fortes, únicas por pessoa (evitar `senha123` como
  usamos no teste).
- O usuário do WiBi configurado em `WIBI_DB_USER` deve ser **realmente
  somente leitura** no SQL Server (confirma isso com quem administra o
  banco, se ainda não confirmou).
- As portas `8081`/`8788` ficam abertas pro mundo todo, não só pra
  Cloudflare — tecnicamente alguém poderia acessar direto pelo IP,
  pulando o Worker. Pra fechar isso de vez, o ideal é restringir o
  firewall do Lightsail pra aceitar essas portas só dos [ranges de IP da
  Cloudflare](https://www.cloudflare.com/ips/) — posso te ajudar a
  configurar isso depois se quiser, não é bloqueante pra ir ao ar agora.
