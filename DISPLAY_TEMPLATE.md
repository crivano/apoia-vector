# Template de Exibição de Resultados

## Visão Geral

O sistema permite personalizar como os resultados da busca são exibidos através de templates HTML. Ao editar uma fonte de dados, você pode especificar um **Template de Exibição** que será usado para formatar cada resultado na página de busca.

## Como Funcionar

### 1. Editando uma Fonte de Dados

Acesse a página de edição de uma fonte de dados e localize o campo **Template de Exibição** na seção de **Mapeamento JSONPath**.

### 2. Sintaxe do Template

O template usa uma sintaxe simples de interpolação com `{{$.campo}}`:

```html
<div>
  <strong>{{$.titulo}}</strong><br>
  <span>{{$.descricao}}</span>
</div>
```

- `{{$.campo}}` - Acessa um campo no nível raiz do JSON
- `{{$.campo.subcampo}}` - Acessa campos aninhados

### 3. Exemplos Práticos

#### Exemplo 1: Título e Descrição Simples

**Dados JSON:**
```json
{
  "id": "123",
  "titulo": "Tema STF",
  "descricao": "Descrição do tema"
}
```

**Template:**
```html
<div>
  <h6 class="mb-1">{{$.titulo}}</h6>
  <p class="text-muted mb-0">{{$.descricao}}</p>
</div>
```

#### Exemplo 2: Card com Múltiplos Campos

**Dados JSON:**
```json
{
  "numero": "RE-1234",
  "relator": "Ministro XYZ",
  "data": "2024-01-15",
  "ementa": "Texto da ementa..."
}
```

**Template:**
```html
<div class="card-body p-0">
  <div class="d-flex justify-content-between mb-2">
    <strong>{{$.numero}}</strong>
    <small class="text-muted">{{$.data}}</small>
  </div>
  <div class="mb-2">
    <small><strong>Relator:</strong> {{$.relator}}</small>
  </div>
  <p class="mb-0">{{$.ementa}}</p>
</div>
```

#### Exemplo 3: Lista de Tags

**Dados JSON:**
```json
{
  "titulo": "Decisão",
  "tags": "civil, consumidor, direito",
  "orgao": "STF"
}
```

**Template:**
```html
<div>
  <strong>{{$.titulo}}</strong>
  <span class="badge bg-secondary ms-2">{{$.orgao}}</span>
  <br>
  <small class="text-muted">Tags: {{$.tags}}</small>
</div>
```

## Classes CSS Disponíveis

O sistema usa Bootstrap 5, então você pode usar qualquer classe do Bootstrap:

### Tipografia
- `fw-bold`, `fw-semibold`, `fw-normal` - Pesos de fonte
- `fs-6`, `fs-7` - Tamanhos de fonte
- `text-muted`, `text-primary`, `text-danger` - Cores

### Espaçamento
- `mb-1`, `mb-2`, `mb-3` - Margin bottom
- `mt-1`, `mt-2`, `mt-3` - Margin top
- `p-2`, `p-3` - Padding

### Layout
- `d-flex`, `justify-content-between` - Flexbox
- `badge` - Badges/Tags
- `small` - Texto pequeno

## Comportamento Padrão

Se você **não especificar** um template de exibição, o sistema exibirá apenas o conteúdo simples extraído através do `contentPath`.

## Dicas e Boas Práticas

1. **Mantenha simples**: Templates muito complexos podem dificultar a leitura
2. **Use classes Bootstrap**: Mantenha consistência visual com o resto da aplicação
3. **Teste com dados reais**: Após configurar, faça uma busca para ver como ficou
4. **Campos opcionais**: Se um campo não existir no JSON, ele será substituído por vazio
5. **HTML seguro**: Evite usar JavaScript ou eventos inline no template

## Exemplo Completo

**Template recomendado para jurisprudência:**

```html
<div>
  <div class="d-flex justify-content-between align-items-start mb-1">
    <strong class="text-primary">{{$.numero_processo}}</strong>
    <span class="badge bg-secondary">{{$.tribunal}}</span>
  </div>
  <div class="mb-2">
    <small class="text-muted">
      <strong>Relator:</strong> {{$.relator}} | 
      <strong>Data:</strong> {{$.data_julgamento}}
    </small>
  </div>
  <p class="mb-1">{{$.ementa}}</p>
  <small class="text-muted">{{$.classe}} - {{$.orgao_julgador}}</small>
</div>
```

## Depuração

Para verificar quais campos estão disponíveis no JSON:
1. Faça uma busca
2. Clique no badge da fonte do resultado para expandir os detalhes
3. Veja o JSON completo exibido
4. Use os nomes dos campos no template com `{{$.campo}}`
