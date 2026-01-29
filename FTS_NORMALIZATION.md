# Normalização de Scores de Busca Textual (FTS)

## Problema Identificado

A busca textual (Full-Text Search) estava retornando scores muito baixos (frequentemente 0-5%), mesmo quando havia correspondências claras de palavras entre a query e os documentos.

### Diagnóstico

O PostgreSQL's `ts_rank` e `ts_rank_cd` retornam valores naturalmente muito pequenos:

- `ts_rank` (default): ~0.01 a 0.15 (1% a 15%)
- `ts_rank_cd` (default): ~0.001 a 0.05 (0.1% a 5%)
- `ts_rank(norm=1)`: ~0.02 a 0.05 (2% a 5%)

**Exemplo real com query "casamento união":**
```sql
ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', 'casamento união'), 1)
-- Retorna: 0.0325 (3.25%)
```

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
- `ts_rank(..., 1)`: Usa normalização de comprimento (normalization=1)
- `* 10`: Multiplica por 10 para amplificar o score
- `LEAST(..., 1.0)`: Limita o máximo a 1.0 (100%)

### Resultados Após Normalização

Query: "casamento união"
- **Antes**: 3.25% → **Depois**: 32.5%

Query: "direito consumidor"
- **Antes**: 4.24% → **Depois**: 42.4%

Query: "processo civil"
- **Antes**: 2.60% → **Depois**: 26.0%

## Implementação

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

1. Remove acentos (união → unia)
2. Aplica stemming em português (casamento → casament)
3. Remove stopwords (de, para, com, etc.)

Isso melhora a correspondência de textos com variações ortográficas comuns.

## Referências

- [PostgreSQL Text Search Functions](https://www.postgresql.org/docs/current/textsearch-controls.html)
- [ts_rank vs ts_rank_cd](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-RANKING)
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
