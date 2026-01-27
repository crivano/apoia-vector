# Controle de Limite Diário de Embeddings

## Visão Geral

O sistema implementa um controle de limite diário para geração de embeddings, ajudando a controlar custos e prevenir uso excessivo da API de embeddings (OpenAI ou Google Gemini).

## Como Funciona

### 1. Tabela de Controle

Uma nova tabela `embedding_usage` foi criada no banco de dados para rastrear o uso diário:

```sql
CREATE TABLE embedding_usage (
  usage_date DATE PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 2. Contador Automático

Cada vez que uma embedding é gerada, o sistema:
1. Verifica se o limite diário foi atingido
2. Se não foi atingido, incrementa o contador
3. Se foi atingido, lança um erro impedindo a operação

### 3. Configuração

Adicione a seguinte variável de ambiente no seu arquivo `.env`:

```env
# Limite diário de geração de embeddings
# 0 = ilimitado (não recomendado para produção)
DAILY_EMBEDDING_LIMIT=10000
```

**Valores recomendados:**
- **Desenvolvimento:** 1000-5000
- **Produção pequena:** 10000-50000
- **Produção grande:** 100000+
- **Ilimitado:** 0 (use com cuidado!)

## Visualização do Uso

### Dashboard

O dashboard mostra um card com as estatísticas de uso diário:
- **Embeddings Hoje:** Quantidade utilizada no dia atual
- **Limite:** Limite configurado
- **Restante:** Quantidade disponível até o limite

O card muda de cor automaticamente:
- 🔵 **Azul (info):** Uso normal (> 10% restante)
- ⚠️ **Amarelo (warning):** Uso crítico (< 10% restante)

### API Endpoint

Você pode consultar o uso atual através da API:

```bash
GET /api/usage
```

**Resposta:**
```json
{
  "success": true,
  "usage": {
    "date": "2026-01-27",
    "used": 1523,
    "limit": 10000,
    "remaining": 8477
  }
}
```

## Comportamento ao Atingir o Limite

Quando o limite diário é atingido:

1. **Geração de Embeddings:** Falha com erro claro
2. **Sincronização de Fontes:** Interrompida com mensagem de erro
3. **Busca Vetorial:** Continua funcionando normalmente (usa embeddings existentes)

**Mensagem de erro:**
```
Daily embedding limit exceeded. Used: 10000/10000. 
Requested: 1. Please try again tomorrow.
```

## Reset Automático

O contador é resetado automaticamente à meia-noite (00:00) no fuso horário do servidor. Um novo registro é criado para o novo dia com contador zerado.

## Funções Disponíveis

### `checkAndIncrementUsage(count: number)`
Verifica e incrementa o uso diário (uso interno)

### `getDailyUsage()`
Retorna estatísticas do uso atual:
```typescript
const usage = await getDailyUsage();
console.log(`Usado: ${usage.used}/${usage.limit}`);
console.log(`Restante: ${usage.remaining}`);
```

## Casos de Uso

### Sincronização de Fontes

Ao sincronizar uma fonte com 1000 itens novos:
- Sistema verifica se há 1000 embeddings disponíveis
- Se sim, processa normalmente
- Se não, retorna erro antes de iniciar

### Busca (Query)

Cada busca gera 1 embedding:
- Consume 1 do limite diário
- Se limite atingido, busca falha
- Usuário deve aguardar até o próximo dia

## Monitoramento

### Logs

O sistema registra automaticamente:
- Tentativas de geração quando limite é atingido
- Incrementos do contador
- Erros de transação no banco

### Alertas

Configure alertas baseados no endpoint `/api/usage`:
```bash
# Verificar uso a cada hora
curl https://seu-app.com/api/usage
```

## Boas Práticas

1. **Configure um limite realista:** Não use 0 (ilimitado) em produção
2. **Monitore regularmente:** Verifique o dashboard ou API
3. **Planeje sincronizações:** Execute em horários de baixo uso
4. **Considere batch:** Sincronize múltiplas fontes de uma vez
5. **Ajuste conforme necessário:** Aumente o limite se atingir frequentemente

## Troubleshooting

### Problema: "Daily limit exceeded" mas é início do dia

**Solução:** Verifique o fuso horário do servidor:
```sql
SELECT NOW() AS server_time;
SELECT * FROM embedding_usage ORDER BY usage_date DESC LIMIT 1;
```

### Problema: Contador não reseta

**Solução:** O reset é automático. Verifique se há um registro para o dia atual:
```sql
SELECT * FROM embedding_usage WHERE usage_date = CURRENT_DATE;
```

### Problema: Limite muito baixo

**Solução:** Aumente a variável de ambiente:
```env
DAILY_EMBEDDING_LIMIT=50000
```

E reinicie a aplicação.

## Migração de Dados Existentes

Se você já tem o sistema rodando, execute a migration:

```bash
npm run db:migrate
```

Isso criará a tabela `embedding_usage` sem afetar dados existentes.

## Custos Estimados

### Google Gemini (Embedding-001)
- **Gratuito:** Até 1500 requisições/dia
- **Após limite:** Indisponível

### OpenAI (text-embedding-3-small)
- **Custo:** ~$0.02 por 1M tokens
- **Estimativa:** 1000 embeddings ≈ $0.02-0.05

### Recomendação

Para controle de custos, configure:
- **Google Gemini:** `DAILY_EMBEDDING_LIMIT=1400`
- **OpenAI:** Baseado no budget disponível

## Referências

- [Google Gemini Pricing](https://ai.google.dev/pricing)
- [OpenAI Pricing](https://openai.com/pricing)
- [Migration 005](../src/lib/migrations/005_add_embedding_usage_tracking.ts)
