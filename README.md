# Apoia-Vector

Sistema de indexação vetorial de fontes de dados REST com busca semântica.

## 🚀 Funcionalidades

- **Configuração de Fontes REST**: Configure endpoints GET/POST com mapeamento JSONPath
- **Paginação**: Suporte a paginação por página, offset ou cursor
- **Sincronização Automática**: Sincronize dados periodicamente
- **Embeddings Vetoriais**: Geração automática de embeddings usando OpenAI
- **Busca Semântica**: Busca por similaridade vetorial com pgvector
- **Transformação de Dados**: Pré-processe JSON antes de armazenar

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL com extensão pgvector (recomendado: NeonDB)
- Chave API da OpenAI

## 🛠️ Instalação

1. Clone o repositório e instale dependências:

```bash
npm install
```

2. Configure as variáveis de ambiente:

```bash
cp .env.example .env.local
```

Edite `.env.local` com suas credenciais:

```env
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
OPENAI_API_KEY=sk-your-key
# Para OpenShift/K8s, adicione também:
APP_URL=https://sua-app.example.com
```

3. Execute as migrations do banco:

```bash
npm run db:migrate
```

4. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

## 🗄️ Configuração do NeonDB

1. Crie uma conta em [neon.tech](https://neon.tech)
2. Crie um novo projeto
3. Copie a connection string para `DATABASE_URL`
4. A extensão pgvector já está habilitada por padrão no NeonDB

## 📖 Uso

### Configurando uma Fonte de Dados

1. Acesse `/sources/new`
2. Preencha os campos:
   - **Nome**: Identificador da fonte
   - **Endpoint**: URL da API REST
   - **Método**: GET ou POST
   - **Caminho do Array**: JSONPath para o array de resultados (ex: `$.data.items`)
   - **Caminho do ID**: JSONPath para o ID de cada item (ex: `$.id`)
   - **Caminho do Conteúdo**: JSONPath para o texto a vetorizar (ex: `$.descricao`)

### Exemplo: Temas do STF

Para indexar temas de repercussão geral do STF:

```
Nome: Temas STF
Endpoint: https://portal.stf.jus.br/...
Método: GET
Caminho do Array: $.resultado
Caminho do ID: $.numero
Caminho do Conteúdo: $.descricao
Template de Conteúdo: Tema {{$.numero}}: {{$.titulo}} - {{$.descricao}}
```

### Busca Semântica

1. Acesse `/search`
2. Digite sua consulta
3. Selecione as fontes desejadas
4. Ajuste o limiar de similaridade

## 🔄 Sincronização Automática

### OpenShift / Kubernetes

Para deploy no OpenShift ou Kubernetes, use um CronJob que chama o endpoint HTTP. Veja o arquivo `openshift-cronjob.yaml` e a documentação completa em [OPENSHIFT.md](OPENSHIFT.md).

### Sincronização Manual

Você pode iniciar uma sincronização manualmente pela interface web ou chamando o endpoint:

```bash
curl -X POST https://sua-app.example.com/api/v1/sources/{id}/sync-chunked
```

## 🏗️ Estrutura do Projeto

```
src/
├── app/
│   ├── api/
│   │   ├── sources/      # CRUD de fontes
│   │   ├── search/       # Busca vetorial
│   │   ├── cron/         # Sincronização automática
│   │   └── stats/        # Estatísticas
│   ├── sources/          # Páginas de fontes
│   └── search/           # Página de busca
├── components/           # Componentes React
├── lib/
│   ├── db.ts            # Conexão Knex
│   ├── embeddings.ts    # Vercel AI SDK
│   ├── jsonpath.ts      # Extração JSONPath
│   ├── sync.ts          # Sincronização
│   └── migrations/      # Migrações do banco
└── types/               # TypeScript types
```

## 📚 Tecnologias

- **Next.js 16** - Framework React
- **Knex.js** - Query builder SQL
- **PostgreSQL + pgvector** - Banco vetorial
- **Vercel AI SDK** - Embeddings OpenAI
- **Bootstrap 5** - UI Framework
- **TypeScript** - Tipagem estática

## 🚀 Deploy

### OpenShift / Kubernetes

1. Siga o guia completo em [OPENSHIFT.md](OPENSHIFT.md)
2. Configure as variáveis de ambiente necessárias (incluindo `APP_URL`)
3. Use o CronJob para sincronização automática

### Desenvolvimento Local

```bash
npm run dev
```

## 📄 Licença

MIT

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
