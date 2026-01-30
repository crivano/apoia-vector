# Uso de Slugs em Data Sources

## 📋 Visão Geral

A partir da versão com migration 009, todos os data sources possuem um campo `slug` - um identificador amigável para URLs que substitui o uso de UUIDs na API de busca.

## ✨ Características

- **Formato**: lowercase, alfanumérico com hífens (`[a-z0-9]+(?:-[a-z0-9]+)*`)
- **Único**: Cada slug é único no banco de dados
- **Auto-gerado**: Se não fornecido, é gerado automaticamente a partir do `name`
- **Geração inteligente**: Remove acentos, caracteres especiais, e garante unicidade com sufixos numéricos

## 📝 Exemplos de Slugs

```
"Blog Posts"           → "blog-posts"
"API Data (2025)"      → "api-data-2025"
"São Paulo - Brasil"   → "sao-paulo-brasil"
"Documentação Técnica" → "documentacao-tecnica"
```

## 🔧 API: Criar Data Source

### Com slug customizado

```bash
POST /api/sources
Content-Type: application/json

{
  "name": "Blog Posts",
  "slug": "blog-posts",  # ← Opcional
  "endpoint": "https://api.example.com/posts",
  "method": "GET",
  "arrayPath": "$.data",
  "idPath": "$.id",
  "contentPath": "$.content"
}
```

### Sem slug (auto-gerado)

```bash
POST /api/sources
Content-Type: application/json

{
  "name": "Blog Posts",
  # slug será "blog-posts" automaticamente
  "endpoint": "https://api.example.com/posts",
  "method": "GET",
  "arrayPath": "$.data",
  "idPath": "$.id",
  "contentPath": "$.content"
}
```

### Resposta

```json
{
  "source": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "blog-posts",
    "name": "Blog Posts",
    "endpoint": "https://api.example.com/posts",
    ...
  }
}
```

## 🔍 API: Buscar usando Slugs

### Antes (com UUIDs)

```bash
POST /api/search
Content-Type: application/json

{
  "query": "postgresql",
  "sourceIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  ]
}
```

### Agora (com slugs) ✅

```bash
POST /api/search
Content-Type: application/json

{
  "query": "postgresql",
  "sourceSlugs": ["blog-posts", "documentation"]
}
```

### Buscar em todos os sources

```bash
POST /api/search
Content-Type: application/json

{
  "query": "postgresql"
  # Sem sourceSlugs = busca em todos
}
```

## 🔄 API: Atualizar Data Source

### Atualizar slug

```bash
PUT /api/sources/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "name": "Blog Posts",
  "slug": "new-blog-posts",  # ← Novo slug
  ...
}
```

### Validação

- ❌ Slug inválido: `"Blog Posts"`, `"blog_posts"`, `"BLOG-POSTS"`
- ✅ Slug válido: `"blog-posts"`, `"api-2025"`, `"docs-v2"`

### Erro: Slug duplicado

```json
{
  "error": "Slug already in use by another source"
}
```

Status: `409 Conflict`

## 🎯 Geração Automática de Slugs

### Processo

1. Converte para lowercase
2. Normaliza unicode (remove acentos)
3. Remove caracteres especiais
4. Substitui espaços por hífens
5. Remove hífens consecutivos
6. Verifica unicidade
7. Se duplicado, adiciona sufixo `-2`, `-3`, etc.

### Código

```typescript
import { generateSlug, isValidSlug } from "@/lib/slug";

const slug = generateSlug("Blog Posts");
// → "blog-posts"

const isValid = isValidSlug("blog-posts");
// → true
```

## 📊 Listar Data Sources

```bash
GET /api/sources
```

**Resposta:**

```json
{
  "sources": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "slug": "blog-posts",
      "name": "Blog Posts",
      ...
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "slug": "documentation",
      "name": "Documentation",
      ...
    }
  ]
}
```

## ⚠️ Observações

### Unicidade garantida

Se você criar dois sources com o mesmo nome:

```
1. "Blog Posts" → slug: "blog-posts"
2. "Blog Posts" → slug: "blog-posts-2"
3. "Blog Posts" → slug: "blog-posts-3"
```

### Compatibilidade

- ✅ Novo campo `slug` foi adicionado a todos os sources existentes
- ✅ Slugs foram gerados automaticamente pela migration
- ✅ API de busca agora aceita apenas `sourceSlugs` (não mais `sourceIds`)
- ⚠️ Clients devem migrar de `sourceIds` para `sourceSlugs`

## 🛠️ Troubleshooting

### Erro 404: No sources found

```json
{
  "error": "No sources found with the provided slugs"
}
```

**Causa**: Nenhum dos slugs fornecidos existe no banco de dados.

**Solução**: Verifique os slugs disponíveis com `GET /api/sources`

### Erro 400: Invalid slug format

```json
{
  "error": "Invalid slug format. Use lowercase letters, numbers, and hyphens only."
}
```

**Causa**: Slug fornecido não segue o padrão `[a-z0-9]+(?:-[a-z0-9]+)*`

**Solução**: Use apenas lowercase, números e hífens. Ex: `blog-posts`, não `Blog_Posts`
