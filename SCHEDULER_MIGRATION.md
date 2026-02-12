# Migração do Scheduler Interno para CronJob do OpenShift

## Resumo

O agendamento de sincronizações foi migrado do scheduler interno (node-cron) para CronJob do OpenShift, seguindo as melhores práticas para ambientes Kubernetes/OpenShift.

## Mudanças Realizadas

### 1. CronJob do OpenShift
- **Arquivo:** `openshift-cronjob.yaml`
- **Schedule:** Diariamente às 2:15 AM (15 2 * * *)
- **Endpoint:** `GET /api/v1/cron/sync-start`
- **Autenticação:** Bearer token via `CRON_SECRET`

### 2. Scheduler Interno Desabilitado
- O scheduler interno (`src/lib/scheduler.ts`) agora está **desabilitado por padrão**
- Pode ser reabilitado com `ENABLE_INTERNAL_SCHEDULER=true` (não recomendado)

## Como Aplicar no OpenShift

### Passo 1: Criar o Secret com CRON_SECRET

```bash
# Gerar um token seguro
CRON_SECRET=$(openssl rand -hex 32)

# Criar o secret no OpenShift
oc create secret generic apoia-vector-secrets \
  --from-literal=cron-secret=$CRON_SECRET

# Ou atualizar secret existente
oc patch secret apoia-vector-secrets \
  -p "{\"data\":{\"cron-secret\":\"$(echo -n $CRON_SECRET | base64)\"}}"
```

### Passo 2: Atualizar a Aplicação Principal

A aplicação precisa ter acesso ao mesmo `CRON_SECRET` para validar as requisições do cron:

```bash
# No DeploymentConfig ou Deployment da aplicação
oc set env deployment/apoia-vector \
  CRON_SECRET='[from-secret]apoia-vector-secrets/cron-secret'
```

Ou adicione manualmente ao YAML:

```yaml
env:
- name: CRON_SECRET
  valueFrom:
    secretKeyRef:
      name: apoia-vector-secrets
      key: cron-secret
```

### Passo 3: Configurar APP_URL

```bash
# Definir a URL da aplicação (necessário para o cron chamar a API)
oc set env deployment/apoia-vector \
  APP_URL='https://apoia-vector.apps.your-openshift-domain.com'
```

### Passo 4: Ajustar o openshift-cronjob.yaml

Edite o arquivo `openshift-cronjob.yaml` e ajuste:

```yaml
env:
- name: APP_URL
  value: "https://apoia-vector.apps.SEU-DOMINIO.com"  # <-- Ajustar
```

### Passo 5: Aplicar o CronJob

```bash
oc apply -f openshift-cronjob.yaml
```

### Passo 6: Verificar

```bash
# Ver o CronJob criado
oc get cronjob

# Ver execuções
oc get jobs

# Ver logs da última execução
oc logs job/apoia-vector-sync-[timestamp]
```

## Testando Manualmente

Para testar sem esperar o horário agendado:

```bash
# Criar um Job manualmente a partir do CronJob
oc create job apoia-vector-sync-manual --from=cronjob/apoia-vector-sync

# Ver o progresso
oc get jobs
oc logs job/apoia-vector-sync-manual
```

## Mudando o Horário de Execução

Edite o `schedule` no arquivo `openshift-cronjob.yaml`:

```yaml
spec:
  # Formato: "minuto hora dia mês dia-da-semana"
  schedule: "15 2 * * *"   # 2:15 AM diariamente
  # schedule: "0 */4 * * *"  # A cada 4 horas
  # schedule: "30 3 * * 0"   # Domingos às 3:30 AM
```

Depois aplique novamente:

```bash
oc apply -f openshift-cronjob.yaml
```

## Rollback para Scheduler Interno

Se necessário voltar ao scheduler interno:

```bash
# Deletar o CronJob
oc delete cronjob apoia-vector-sync

# Habilitar scheduler interno
oc set env deployment/apoia-vector \
  ENABLE_INTERNAL_SCHEDULER=true
```

## Vantagens do CronJob do OpenShift

✅ **Separação de responsabilidades:** A aplicação não precisa gerenciar agendamento  
✅ **Escalabilidade:** Funciona em ambientes com múltiplas réplicas  
✅ **Monitoramento:** Logs e histórico separados no OpenShift  
✅ **Controle:** Fácil de pausar, executar manualmente ou mudar horários  
✅ **Resiliência:** OpenShift gerencia a execução e retry automático  

## Troubleshooting

### CronJob não executa

```bash
# Verificar se está suspenso
oc get cronjob apoia-vector-sync -o yaml | grep suspend

# Verificar eventos
oc describe cronjob apoia-vector-sync

# Verificar se o schedule está correto
oc get cronjob apoia-vector-sync -o yaml | grep schedule
```

### Erro 401 Unauthorized

- Verificar se `CRON_SECRET` está definido tanto no CronJob quanto na aplicação
- Verificar se os valores coincidem

```bash
# Ver secret (base64 encoded)
oc get secret apoia-vector-secrets -o yaml
```

### APP_URL incorreto

```bash
# Verificar rota da aplicação
oc get route apoia-vector

# Atualizar APP_URL na aplicação
oc set env deployment/apoia-vector \
  APP_URL='https://[rota-correta]'
```

## Monitoramento

### Ver próxima execução

```bash
oc get cronjob apoia-vector-sync
```

### Ver histórico de execuções

```bash
# Jobs bem-sucedidos e falhos
oc get jobs -l app=apoia-vector

# Logs detalhados
oc logs -l component=sync-cron --tail=100
```

### Alertas recomendados

Configure alertas para:
- Jobs que falham consecutivamente
- Jobs que excedem o tempo limite (1 hora)
- Jobs que não executam no horário esperado
