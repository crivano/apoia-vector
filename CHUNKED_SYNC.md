# Chunked Sync - Sincronização em Partes

## Visão Geral

O sistema implementa uma estratégia de **sincronização em chunks** (partes) para contornar as limitações de timeout das serverless functions do Vercel (10 segundos no plano gratuito).

Ao invés de processar todas as fontes e páginas em uma única requisição longa, o sistema:
1. Divide o trabalho em **pequenas tarefas** (1 página de 1 fonte por vez)
2. Processa cada tarefa em **< 5 segundos**
3. **Dispara automaticamente** a próxima tarefa ao concluir
4. Continua até processar todas as páginas de todas as fontes

## Como Funciona

### 1. Fluxo Completo

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Vercel Cron (3h da manhã)                                  │
│    Dispara: /api/cron/sync-start                             │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 v
┌──────────────────────────────────────────────────────────────┐
│ 2. Sync Start                                                 │
│    • Cria nova sessão de sync                                │
│    • Adiciona página 1 de cada fonte na fila (sync_queue)   │
│    • Dispara primeira requisição para /api/cron/sync-chunk  │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 v
┌──────────────────────────────────────────────────────────────┐
│ 3. Sync Chunk (Loop até concluir todas as páginas)          │
│    • Pega próxima tarefa pendente da fila                   │
│    • Busca 1 página da API externa                          │
│    • Compara com banco e atualiza (add/update)             │
│    • Se houver mais páginas, adiciona próxima na fila       │
│    • Marca tarefa como concluída                            │
│    • Dispara próxima requisição para /api/cron/sync-chunk  │
│    • Repete até a fila estar vazia                          │
└──────────────────────────────────────────────────────────────┘
```

### 2. Estrutura do Banco

#### Tabela `sync_sessions`
Rastreia sessões completas de sincronização:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | ID único da sessão |
| status | TEXT | 'running', 'completed', 'failed', 'partial' |
| total_chunks | INT | Total de páginas a processar |
| completed_chunks | INT | Páginas processadas com sucesso |
| failed_chunks | INT | Páginas que falharam |
| total_items_added | INT | Total de itens adicionados |
| total_items_updated | INT | Total de itens atualizados |
| total_items_deleted | INT | Total de itens deletados |
| created_at | TIMESTAMP | Início da sessão |
| completed_at | TIMESTAMP | Fim da sessão |

#### Tabela `sync_queue`
Fila de tarefas a processar:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | ID único da tarefa |
| source_id | UUID | Fonte de dados |
| sync_session_id | UUID | Sessão à qual pertence |
| page_number | INT | Número da página (para paginação por offset/page) |
| page_type | TEXT | 'page', 'offset', 'cursor', 'initial' |
| cursor_value | TEXT | Valor do cursor (para paginação por cursor) |
| status | TEXT | 'pending', 'processing', 'completed', 'failed' |
| error_message | TEXT | Mensagem de erro (se falhou) |
| items_processed | INT | Quantidade de itens processados |
| created_at | TIMESTAMP | Criação da tarefa |
| started_at | TIMESTAMP | Início do processamento |
| completed_at | TIMESTAMP | Fim do processamento |

### 3. Endpoints

#### `/api/cron/sync-start` (GET)
- **Chamado por**: Vercel Cron (diariamente às 3h BRT)
- **Autenticação**: Bearer token com `CRON_SECRET`
- **Função**: Inicializa uma nova sessão de sync
- **Retorna**: `{ sessionId, totalChunks, nextUrl }`

#### `/api/cron/sync-chunk` (GET)
- **Chamado por**: Ele mesmo (recursivamente) ou sync-start
- **Autenticação**: Bearer token com `CRON_SECRET`
- **Função**: Processa 1 chunk da fila
- **Retorna**: `{ message, itemsProcessed, hasMore, nextUrl }`

#### `/api/sync-progress` (GET)
- **Chamado por**: Dashboard (polling a cada 3s)
- **Autenticação**: Não requer
- **Função**: Retorna progresso da sessão atual
- **Retorna**: `{ session: { id, status, progress, ... } }`

## Vantagens

### ✅ Contorna Timeout do Vercel Free
- Cada chunk processa em **2-5 segundos**
- Bem abaixo do limite de 10 segundos
- Funciona perfeitamente no plano gratuito

### ✅ Resiliente a Falhas
- Se uma página falha, não afeta as outras
- Continua processando páginas restantes
- Log detalhado de erros por página

### ✅ Observabilidade
- Dashboard mostra progresso em tempo real
- Barra de progresso durante sincronização
- Estatísticas detalhadas (itens novos, atualizados, falhas)

### ✅ Escalável
- Processa fontes com milhares de páginas
- Sem limite prático de quantidade de dados
- Cada página é independente

## Desvantagens

### ⚠️ Tempo Total Maior
- **Sem chunking**: 100 páginas × 2s = 200s (3,3 min) em uma requisição
- **Com chunking**: 100 páginas × 3s (2s + 1s cold start) = 300s (5 min) em 100 requisições

### ⚠️ Cold Starts
- Cada chunk pode ter cold start (~500ms-2s)
- Aumenta tempo total de processamento
- Pode consumir mais recursos do Vercel

### ⚠️ Complexidade
- Mais código para gerenciar fila
- Mais tabelas no banco
- Mais complexo de debugar

## Configuração

### Variáveis de Ambiente

```env
# URL base da aplicação (para disparar chunks)
VERCEL_URL=seu-app.vercel.app
# ou
NEXT_PUBLIC_BASE_URL=https://seu-app.com

# Secret para autenticar cron jobs
CRON_SECRET=seu-secret-aleatorio-aqui
```

### Vercel.json

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-start",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Nota**: O `schedule` é em UTC. `0 6 * * *` = 6h UTC = 3h BRT.

## Monitoramento

### Dashboard

O dashboard mostra em tempo real:
- **Barra de progresso**: Percentual completado
- **Estatísticas**: Páginas processadas, itens novos, atualizações, falhas
- **Status**: Running, Completed, Failed, Partial

### Consultas SQL

#### Ver sessão atual
```sql
SELECT * FROM sync_sessions 
WHERE status = 'running' 
ORDER BY created_at DESC 
LIMIT 1;
```

#### Ver progresso da fila
```sql
SELECT 
  status, 
  COUNT(*) as count 
FROM sync_queue 
WHERE sync_session_id = 'session-id-aqui'
GROUP BY status;
```

#### Ver tarefas com erro
```sql
SELECT 
  sq.*,
  ds.name as source_name
FROM sync_queue sq
JOIN data_sources ds ON sq.source_id = ds.id
WHERE sq.status = 'failed'
ORDER BY sq.created_at DESC
LIMIT 10;
```

#### Últimas 10 sessões
```sql
SELECT 
  id,
  status,
  total_chunks,
  completed_chunks,
  failed_chunks,
  total_items_added + total_items_updated as total_changes,
  EXTRACT(EPOCH FROM (completed_at - created_at)) as duration_seconds,
  created_at
FROM sync_sessions
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### Sync Travou / Parou no Meio

**Problema**: Sessão com status 'running' mas sem progresso há muito tempo.

**Solução**:
```sql
-- 1. Verificar se há tarefas travadas em 'processing'
SELECT * FROM sync_queue 
WHERE status = 'processing' 
AND started_at < NOW() - INTERVAL '5 minutes';

-- 2. Resetar tarefas travadas para 'pending'
UPDATE sync_queue 
SET status = 'pending', started_at = NULL 
WHERE status = 'processing' 
AND started_at < NOW() - INTERVAL '5 minutes';

-- 3. Disparar manualmente o próximo chunk
-- Acesse no browser: https://seu-app.vercel.app/api/cron/sync-chunk
-- (adicione header: Authorization: Bearer SEU_CRON_SECRET)
```

### Muitas Falhas

**Problema**: Muitos chunks com status 'failed'.

**Diagnóstico**:
```sql
-- Ver mensagens de erro
SELECT 
  error_message,
  COUNT(*) as occurrences
FROM sync_queue
WHERE status = 'failed'
GROUP BY error_message
ORDER BY occurrences DESC;
```

**Soluções Comuns**:
- **"HTTP 429" ou "Rate limit"**: API externa tem limite de requisições. Reduzir frequência do cron ou adicionar delay entre chunks.
- **"HTTP 401" ou "Unauthorized"**: Credenciais inválidas nos headers da fonte.
- **"Timeout"**: API externa muito lenta. Verificar se endpoint está respondendo.
- **"Embedding quota exceeded"**: Atingiu limite diário de embeddings (10.000). Aguardar reset às 00h UTC.

### Limpar Sessões Antigas

```sql
-- Deletar sessões e fila com mais de 30 dias
DELETE FROM sync_queue 
WHERE sync_session_id IN (
  SELECT id FROM sync_sessions 
  WHERE created_at < NOW() - INTERVAL '30 days'
);

DELETE FROM sync_sessions 
WHERE created_at < NOW() - INTERVAL '30 days';
```

## Testando Localmente

```bash
# 1. Rodar migrations
npm run db:migrate

# 2. Iniciar dev server
npm run dev

# 3. Em outro terminal, disparar sync manualmente
curl http://localhost:3000/api/cron/sync-start

# 4. Acompanhar no dashboard
# Abra: http://localhost:3000/dashboard
```

## Performance Esperada

### Cenário: 3 fontes, 50 páginas cada, 20 itens por página

**Sem Chunking (impossível no Vercel Free)**:
- Tempo: ~150 segundos
- Requisições: 1
- ❌ Timeout após 10s no Vercel Free

**Com Chunking**:
- Tempo: ~240 segundos (4 minutos)
- Requisições: 150 (3 fontes × 50 páginas)
- Cold starts: ~150s (1s cada)
- Processamento: ~90s (0.6s por página)
- ✅ Funciona no Vercel Free

### Otimizações Possíveis

1. **Warm-up**: Manter funções "quentes" com ping periódico
2. **Batch de múltiplas páginas**: Processar 2-3 páginas por chunk (se caber em 8s)
3. **Parallel chunks**: Processar múltiplas fontes em paralelo (cuidado com cold starts)
4. **Background workers**: Migrar para Railway/Render para evitar cold starts

## Comparação com Alternativas

| Solução | Custo | Timeout | Cold Starts | Complexidade |
|---------|-------|---------|-------------|--------------|
| **Chunked Sync (atual)** | Grátis | Sem problema | Sim (~1s cada) | Média |
| **Vercel Pro** | $20/mês | 300s | Sim (~1s) | Baixa |
| **GitHub Actions** | Grátis* | 6 horas | Não | Baixa |
| **Railway/Render** | $5/mês | Ilimitado | Não | Baixa |

*Grátis para repositórios públicos ou 2000 min/mês para privados.

## Conclusão

O chunked sync é uma solução **eficaz e gratuita** para contornar as limitações do Vercel Free Tier. Embora adicione complexidade e aumente o tempo total, permite processar volumes ilimitados de dados sem custo adicional.

Para produção com alto volume, considere:
- **< 100 páginas/dia**: Chunked sync funciona perfeitamente
- **100-500 páginas/dia**: Considere GitHub Actions (grátis)
- **> 500 páginas/dia**: Vercel Pro ou Railway (melhor performance)
