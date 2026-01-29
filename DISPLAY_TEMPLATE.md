# Template de Exibição de Resultados

## Visão Geral

O sistema permite personalizar como os resultados da busca são exibidos através de templates HTML. Ao editar uma fonte de dados, você pode especificar um **Template de Exibição** que será usado para formatar cada resultado na página de busca.

O sistema usa **Nunjucks** como template engine, oferecendo recursos avançados como condicionais, loops e filtros.

## Como Funcionar

### 1. Editando uma Fonte de Dados

Acesse a página de edição de uma fonte de dados e localize o campo **Template de Exibição** na seção de **Mapeamento JSONPath**.

### 2. Sintaxe do Template

O template usa a sintaxe Nunjucks:

#### Interpolação Simples
```html
<div>
  <strong>{{titulo}}</strong><br>
  <span>{{descricao}}</span>
</div>
```

#### Condicionais
```html
{% if autor %}
  <p><strong>Autor:</strong> {{autor}}</p>
{% endif %}

{% if status == "ativo" %}
  <span class="badge bg-success">Ativo</span>
{% else %}
  <span class="badge bg-secondary">Inativo</span>
{% endif %}
```

#### Loops
```html
{% if tags %}
  <div class="mt-2">
    {% for tag in tags %}
      <span class="badge bg-info me-1">{{tag}}</span>
    {% endfor %}
  </div>
{% endif %}
```

#### Filtros
```html
<p>{{texto | upper}}</p>
<p>{{titulo | lower}}</p>
<p>{{descricao | truncate(100)}}</p>
```

### 3. Sintaxe de Campos

- `{{campo}}` - Acessa um campo no nível raiz do JSON
- `{{campo.subcampo}}` - Acessa campos aninhados
- Para compatibilidade com templates antigos, `{{$.campo}}` também funciona (mas recomendamos usar apenas `{{campo}}`)

### 4. Exemplos Práticos

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
  <h6 class="mb-1">{{titulo}}</h6>
  <p class="text-muted mb-0">{{descricao}}</p>
</div>
```

#### Exemplo 2: Card com Múltiplos Campos e Condicionais

**Dados JSON:**
```json
{
  "numero": "RE-1234",
  "relator": "Ministro XYZ",
  "data": "2024-01-15",
  "ementa": "Texto da ementa...",
  "urgente": true
}
```

**Template:**
```html
<div class="card-body p-0">
  <div class="d-flex justify-content-between mb-2">
    <strong>{{numero}}</strong>
    {% if urgente %}
      <span class="badge bg-danger">URGENTE</span>
    {% endif %}
    <small class="text-muted">{{data}}</small>
  </div>
  {% if relator %}
    <div class="mb-2">
      <small><strong>Relator:</strong> {{relator}}</small>
    </div>
  {% endif %}
  <p class="mb-0">{{ementa}}</p>
</div>
```

#### Exemplo 3: Lista de Tags com Loop

**Dados JSON:**
```json
{
  "titulo": "Decisão",
  "tags": ["civil", "consumidor", "direito"],
  "orgao": "STF"
}
```

**Template:**
```html
<div>
  <strong>{{titulo}}</strong>
  <span class="badge bg-secondary ms-2">{{orgao}}</span>
  <br>
  {% if tags and tags.length > 0 %}
    <div class="mt-2">
      {% for tag in tags %}
        <span class="badge bg-info me-1">{{tag}}</span>
      {% endfor %}
    </div>
  {% endif %}
</div>
```

#### Exemplo 4: Formatação Condicional Avançada

**Dados JSON:**
```json
{
  "processo": "12345",
  "status": "pendente",
  "prioridade": 3,
  "partes": ["Autor Silva", "Réu Santos"]
}
```

**Template:**
```html
<div>
  <div class="d-flex justify-content-between align-items-center mb-2">
    <strong>Processo {{processo}}</strong>
    
    {% if status == "concluido" %}
      <span class="badge bg-success">Concluído</span>
    {% elif status == "pendente" %}
      <span class="badge bg-warning">Pendente</span>
    {% else %}
      <span class="badge bg-secondary">{{status | upper}}</span>
    {% endif %}
  </div>
  
  {% if prioridade >= 3 %}
    <div class="alert alert-warning py-1 px-2 mb-2">
      <small>⚠️ Alta prioridade</small>
    </div>
  {% endif %}
  
  {% if partes %}
    <div class="mb-2">
      <small><strong>Partes:</strong></small>
      <ul class="mb-0">
        {% for parte in partes %}
          <li><small>{{parte}}</small></li>
        {% endfor %}
      </ul>
    </div>
  {% endif %}
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

## Recursos Nunjucks Disponíveis

### Operadores
- Comparação: `==`, `!=`, `>`, `<`, `>=`, `<=`
- Lógicos: `and`, `or`, `not`
- Teste: `if valor`, `if not valor`

### Filtros Úteis
- `upper` - Texto em maiúsculas
- `lower` - Texto em minúsculas
- `title` - Primeira letra maiúscula
- `truncate(n)` - Limita texto a n caracteres
- `length` - Retorna tamanho de array/string
- `default(valor)` - Valor padrão se vazio

### Testes
```html
{% if items is defined %}...{% endif %}
{% if valor is none %}...{% endif %}
{% if lista is iterable %}...{% endif %}
```

## Comportamento Padrão

Se você **não especificar** um template de exibição, o sistema exibirá apenas o conteúdo simples extraído através do `contentPath`.

## Dicas e Boas Práticas

1. **Mantenha simples**: Templates muito complexos podem dificultar a leitura
2. **Use classes Bootstrap**: Mantenha consistência visual com o resto da aplicação
3. **Teste com dados reais**: Após configurar, faça uma busca para ver como ficou
4. **Campos opcionais**: Use `{% if campo %}` para verificar se existe antes de usar
5. **HTML seguro**: Evite usar JavaScript ou eventos inline no template
6. **Loops seguros**: Sempre verifique se o array existe antes de fazer loop
7. **Filtros**: Use filtros para formatar dados (upper, lower, truncate, etc)

## Exemplo Completo

**Template recomendado para jurisprudência:**

```html
<div>
  <div class="d-flex justify-content-between align-items-start mb-1">
    <strong class="text-primary">{{numero_processo}}</strong>
    {% if tribunal %}
      <span class="badge bg-secondary">{{tribunal}}</span>
    {% endif %}
  </div>
  
  {% if relator or data_julgamento %}
    <div class="mb-2">
      <small class="text-muted">
        {% if relator %}
          <strong>Relator:</strong> {{relator}}
        {% endif %}
        {% if relator and data_julgamento %} | {% endif %}
        {% if data_julgamento %}
          <strong>Data:</strong> {{data_julgamento}}
        {% endif %}
      </small>
    </div>
  {% endif %}
  
  {% if ementa %}
    <p class="mb-1">{{ementa | truncate(200)}}</p>
  {% endif %}
  
  {% if classe or orgao_julgador %}
    <small class="text-muted">
      {% if classe %}{{classe}}{% endif %}
      {% if classe and orgao_julgador %} - {% endif %}
      {% if orgao_julgador %}{{orgao_julgador}}{% endif %}
    </small>
  {% endif %}
</div>
```

## Depuração

Para verificar quais campos estão disponíveis no JSON:
1. Faça uma busca
2. Clique no badge da fonte do resultado para expandir os detalhes
3. Veja o JSON completo exibido
4. Use os nomes dos campos no template com `{{$.campo}}`
