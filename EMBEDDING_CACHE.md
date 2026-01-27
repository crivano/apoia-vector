# Embedding Cache

## Visão Geral

O sistema implementa um cache de embeddings para otimizar o uso da API e reduzir custos. Cada query de busca é cacheada por 24 horas, evitando regeração desnecessária de embeddings ao paginar resultados ou repetir buscas.

## Como Funciona

### 1. Cache Baseado em Hash

Cada texto é hasheado usando SHA-256:
```typescript
const hash = crypto.createHash('sha256').update(text).digest('hex');
```

### 2. Fluxo de Geração de Embedding

```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  // 1. Verifica cache primeiro
  const cached = await getCachedEmbedding(text);
  if (cached) return cached; // Cache hit - não consome quota
  
  // 2. Cache miss - verifica limite diário
  await checkAndIncrementUsage(1);
  
  // 3. Gera novo embedding
  const { embedding } = await embed(...);
  
  // 4. Armazena no cache para uso futuro
  await setCachedEmbedding(text, embedding);
  
  return embedding;
}
```

### 3. Estrutura do Cache

Tabela: `embedding_cache`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| query_hash | VARCHAR(64) | Hash SHA-256 da query (chave primária) |
| query_text | TEXT | Texto original da query |
| embedding | JSONB | Array de 1536 números (embedding) |
| expires_at | TIMESTAMP | Data/hora de expiração do cache |
| created_at | TIMESTAMP | Data/hora de criação |
| updated_at | TIMESTAMP | Data/hora da última atualização |

### 4. TTL (Time To Live)

- **Padrão**: 24 horas
- **Configurável**: Variável de ambiente `EMBEDDING_CACHE_TTL_HOURS`

```env
EMBEDDING_CACHE_TTL_HOURS=24
```

## Benefícios

### 1. Economia de Custos
- **Problema**: Antes, cada paginação gerava um novo embedding da mesma query
- **Solução**: Com cache, a query só gera embedding uma vez a cada 24 horas
- **Exemplo**: 10 páginas = 1 embedding (vs 10 embeddings sem cache)

### 2. Performance
- Cache hit é ~100x mais rápido que gerar novo embedding
- Reduz latência das buscas repetidas

### 3. Controle de Quota
- Cache hits não consomem a quota diária de embeddings
- Permite mais buscas únicas dentro do limite diário

## Exemplos de Uso

### Cache Hit (Mesma Query)
```typescript
// Primeira busca - gera embedding
await search({ query: "machine learning", page: 1 }); // +1 embedding usado

// Paginação - usa cache
await search({ query: "machine learning", page: 2 }); // +0 embeddings usados
await search({ query: "machine learning", page: 3 }); // +0 embeddings usados

// Busca repetida dentro de 24h - usa cache
await search({ query: "machine learning", page: 1 }); // +0 embeddings usados
```

### Cache Miss (Queries Diferentes)
```typescript
await search({ query: "machine learning", page: 1 });  // +1 embedding
await search({ query: "deep learning", page: 1 });     // +1 embedding
await search({ query: "neural networks", page: 1 });   // +1 embedding
```

## Expiração do Cache

### Limpeza Automática

O cache expira automaticamente após o TTL configurado. Embeddings expirados são ignorados e regerados quando necessário.

### Limpeza Manual (Opcional)

Para limpar embeddings expirados do banco:

```sql
DELETE FROM embedding_cache WHERE expires_at < NOW();
```

## Monitoramento

### Verificar Tamanho do Cache

```sql
SELECT COUNT(*) as total_cached,
       COUNT(*) FILTER (WHERE expires_at > NOW()) as active,
       COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired
FROM embedding_cache;
```

### Queries Mais Cacheadas

```sql
SELECT query_text, created_at, expires_at
FROM embedding_cache
WHERE expires_at > NOW()
ORDER BY updated_at DESC
LIMIT 10;
```

## Configuração

### Variáveis de Ambiente

```env
# Horas até expiração do cache (padrão: 24)
EMBEDDING_CACHE_TTL_HOURS=24
```

### Ajuste do TTL

- **TTL curto** (6-12h): Mais embeddings gerados, cache menos efetivo
- **TTL longo** (48-72h): Melhor economia, mas queries antigas podem estar cacheadas
- **Recomendado**: 24 horas balanceia economia e atualização

## Impacto na Quota Diária

Com cache de 24h e limite de 10.000 embeddings/dia:

| Cenário | Sem Cache | Com Cache | Economia |
|---------|-----------|-----------|----------|
| 1 query, 10 páginas | 10 embeddings | 1 embedding | 90% |
| 100 queries únicas | 100 embeddings | 100 embeddings | 0% |
| 50 queries, 5 páginas cada | 250 embeddings | 50 embeddings | 80% |
| Buscas repetidas ao longo do dia | N embeddings | N embeddings | ~50-70% |

## Troubleshooting

### Cache não está funcionando

1. Verificar se a migration foi executada:
```bash
npm run db:migrate
```

2. Verificar se a tabela existe:
```sql
SELECT * FROM embedding_cache LIMIT 1;
```

### Limpar todo o cache

```sql
TRUNCATE TABLE embedding_cache;
```

## Considerações de Performance

- **Tamanho do Cache**: Cada embedding ocupa ~6KB no banco (1536 floats × 4 bytes)
- **100 queries cacheadas** ≈ 600KB
- **1000 queries cacheadas** ≈ 6MB
- **10000 queries cacheadas** ≈ 60MB

O impacto no banco é mínimo, mesmo com milhares de queries cacheadas.
