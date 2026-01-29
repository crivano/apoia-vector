# Normalização e Operadores de Busca Textual (FTS)

## Problema Identificado

A busca textual (Full-Text Search) estava retornando scores muito baixos (frequentemente 0-5%), mesmo quando havia correspondências claras de palavras entre a query e os documentos. Além disso, o comportamento AND padrão excluía documentos que continham apenas algumas das palavras buscadas.

### Diagnóstico

Dois problemas principais foram identificados:

#### 1. Scores Muito Baixos

O PostgreSQL's `ts_rank` e `ts_rank_cd` retornam valores naturalmente muito pequenos:

- `ts_rank` (default): ~0.01 a 0.15 (1% a 15%)
- `ts_rank_cd` (default): ~0.001 a 0.05 (0.1% a 5%)
- `ts_rank(norm=1)`: ~0.02 a 0.05 (2% a 5%)

**Exemplo real com query "casamento união":**
```sql
ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', 'casamento união'), 1)
-- Retorna: 0.0325 (3.25%)
```

#### 2. Operador AND Muito Restritivo

Por padrão, `plainto_tsquery` junta palavras com operador AND (&):

```sql
plainto_tsquery('portuguese_unaccent', 'previdência tributário')
-- Gera: 'previdenci' & 'tributari'
-- Resultado: Apenas documentos com AMBAS as palavras (muito restritivo)
```

**Impacto:**
Duas melhorias foram aplicadas:

### 1. Normalização de Score (Multiplicador x10)

Aplicamos uma normalização multiplicativa ao score de texto para trazê-lo a uma escala comparável:

**Fórmula:**48 documentos** que contêm pelo menos uma das palavras

### Comparação com Scores Vetoriais

Scores vetoriais usando pgvector tipicamente variam de 0.3 a 0.95 (30% a 95%), criando uma grande disparidade:

- **Vetor**: 30-95% (busca semântica)
- **Texto (sem normalização)**: 1-5% (busca por palavras-chave)

Isso tornava a busca híbrida ineficaz, pois o componente de texto tinha peso insignificante.

## Solução Implementada

Aplicamos uma normalização multiplicativa ao score de texto para trazê-lo a uma escala comparável:

### Fórmula Final

```sql
LEAST(ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', query), 1) * 10, 1.0)
```

**Componentes:**
- `t2. Operador OR em Vez de AND

Substituímos `plainto_tsquery` por uma query construída dinamicamente com operador OR:

**Transformação:**
```sql
-- ANTES (AND - muito restritivo):
plainto_tsquery('portuguese_unaccent', 'previdência tributário')
-- Gera: 'previdenci' & 'tributari'

-- DEPOIS (OR - mais inclusivo):
(
  SELECT to_tsquery('portuguese_unaccent', string_agg(lexeme, ' | '))
  FROM unnest(to_tsvector('portuguese_unaccent', 'previdência tributário'))
)
-- Gera: 'previdenci' | 'tributari'
```

**Benefícios:**
- ✅ Retorna documentos que contêm **qualquer** palavra da query
// Build OR query for text search
const orQueryStr = `(
  SELECT to_tsquery('portuguese_unaccent', string_agg(lexeme, ' | '))
  FROM unnest(to_tsvector('portuguese_unaccent', ?))
)`;

db("vector_items")
  .select(
    "vector_items.*",
    db.raw(`LEAST(ts_rank(fts_tokens, ${orQueryStr}, 1) * 10, 1.0) as text_score`, [query])
  )
  .whereRaw(`fts_tokens @@ ${orQueryStr}`, [query])
```

### Busca Híbrida (modo `hybrid`)

```sql
WITH or_query AS (
  SELECT to_tsquery('portuguese_unaccent', string_agg(lexeme, ' | ')) as tsq
  FROM unnest(to_tsvector('portuguese_unaccent', ?))
),
scored AS (
  SELECT 
    v.*,
    (1 - (v.embedding <=> ?::vector)) as vector_score,
    LEAST(COALESCE(ts_rank(v.fts_tokens, oq.tsq, 1), 0) * 10, 1.0) as text_score
  FROM vector_items v
  CROSS JOIN or_query oq
)
SELECT 
  *,
  (vector_score * ?) + (text_score * ?) as combined_score
FROM scored
WHERE vector_score >= ? OR fts_tokens @@ (SELECT tsq FROM or_query

### Busca Full-Text (modo `fulltext`)

```typescript
db.raw(`
  LEAST(ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', ?), 1) * 10, 1.0) as text_score
`, [query])
```

### Busca Híbrida (modo `hybrid`)

```sql
WITH scored AS (
  SELECT 
    *,
    (1 - (embedding <=> ?::vector)) as vector_score,
    LEAST(COALESCE(ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', ?), 1), 0) * 10, 1.0) as text_score
  FROM vector_items
)
SELECT 
  *,
  (vector_score * ?) + (text_score * ?) as combined_score
FROM scored
WHERE vector_score >= ? OR fts_tokens @@ plainto_tsquery('portuguese_unaccent', ?)
ORDER BY combined_score DESC
```

## Testes Realizados

Foram testados diferentes multiplicadores (x3, x5, x10, x20) para encontrar o melhor equilíbrio:

| Multiplicador | Range Típico | Observação |
|---------------|-------------|------------|
| x3 | 6-15% | Ainda muito baixo |
| x5 | 10-25% | Melhor, mas conservador |
| **x10** | **20-45%** | **Equilíbrio ideal ✅** |
| x20 | 40-90% | Pode dominar demais na busca híbrida |

**Escolha final:** x10 oferece o melhor equilíbrio entre amplificação suficiente e evitar dominação excessiva sobre o score vetorial.

## Impacto na Busca Híbrida

Com pesos padrão de 70% vetor / 30% texto:

### Antes (sem normalização adequada)
```
Score Final = (0.80 × 0.7) + (0.03 × 0.3) = 0.569 (56.9%)
              ↑ vetor      ↑ texto (negligível)
```

### Depois (com normalização x10)
```
Score Final = (0.80 × 0.7) + (0.30 × 0.3) = 0.650 (65.0%)
              ↑ vetor      ↑ texto (significativo)
```

O componente de texto agora contribui de forma significativa para o ranking final.

## Configuração Linguística

O sistema usa a configuração `portuguese_unaccent` que:

Três scripts foram criados para validar as melhorias:

1. `test-fts-scores.ts`: Testa valores brutos do FTS
2. `test-fts-multipliers.ts`: Compara diferentes multiplicadores
3. `test-fts-or.ts`: Demonstra diferença entre AND e OR

Execute com:
```bash
npx tsx test-fts-scores.ts
npx tsx test-fts-multipliers.ts
npx tsx test-fts-or.ts
```

## Exemplo de Uso

Query: "previdência tributário"

**Antes (AND + normalização fraca):**
- Resultados: 1 documento
- Score máximo: ~3%
- Apenas documentos com ambas as palavras

**Depois (OR + normalização x10):**
- Resultados: 149 documentos
- Score máximo: ~11% (múltiplas palavras) 
- Documentos com qualquer palavra

**Impacto:** 
- ✅ +148 documentos relevantes recuperados
- ✅ Scores 3-4x maiores e mais interpretáveis
- ✅ Busca mais útil e alinhada com expectativasts_rank vs ts_rank_cd](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-RANKING)
- [Normalization Parameter](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-RANKING)

## Scripts de Teste

Dois scripts foram criados para validar a normalização:

1. `test-fts-scores.ts`: Testa valores brutos do FTS
2. `test-fts-multipliers.ts`: Compara diferentes multiplicadores

Execute com:
```bash
npx tsx test-fts-scores.ts
npx tsx test-fts-multipliers.ts
```
