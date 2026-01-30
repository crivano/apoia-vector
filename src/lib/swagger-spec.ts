export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Apoia-Vector API",
    version: "1.0.0",
    description: "Sistema de indexação vetorial de fontes de dados REST com busca semântica",
    contact: {
      name: "API Support",
    },
  },
  servers: [
    {
      url: process.env.NEXTAUTH_URL || "http://localhost:3000",
      description: process.env.NODE_ENV === "production" ? "Produção" : "Desenvolvimento",
    },
  ],
  tags: [
    {
      name: "Sources",
      description: "Gerenciamento de fontes de dados",
    },
    {
      name: "Search",
      description: "Busca semântica e híbrida",
    },
    {
      name: "Sync",
      description: "Sincronização de dados",
    },
    {
      name: "Stats",
      description: "Estatísticas e métricas",
    },
  ],
  paths: {
    "/api/sources": {
      get: {
        tags: ["Sources"],
        summary: "Listar todas as fontes de dados",
        description: "Retorna lista de todas as fontes configuradas",
        responses: {
          "200": {
            description: "Lista de fontes",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sources: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/DataSource",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Sources"],
        summary: "Criar nova fonte de dados",
        description: "Cria uma nova fonte de dados para sincronização",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/DataSourceInput",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Fonte criada com sucesso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    source: {
                      $ref: "#/components/schemas/DataSource",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Dados inválidos",
          },
        },
      },
    },
    "/api/sources/{id}": {
      get: {
        tags: ["Sources"],
        summary: "Obter fonte específica",
        description: "Retorna detalhes de uma fonte de dados",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
        ],
        responses: {
          "200": {
            description: "Detalhes da fonte",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    source: {
                      $ref: "#/components/schemas/DataSource",
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "Fonte não encontrada",
          },
        },
      },
      put: {
        tags: ["Sources"],
        summary: "Atualizar fonte de dados",
        description: "Atualiza configurações de uma fonte existente",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/DataSourceInput",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Fonte atualizada",
          },
          "404": {
            description: "Fonte não encontrada",
          },
        },
      },
      delete: {
        tags: ["Sources"],
        summary: "Deletar fonte de dados",
        description: "Remove uma fonte e todos os seus itens",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
        ],
        responses: {
          "200": {
            description: "Fonte deletada",
          },
          "404": {
            description: "Fonte não encontrada",
          },
        },
      },
    },
    "/api/sources/{id}/sync": {
      post: {
        tags: ["Sync"],
        summary: "Sincronizar fonte específica",
        description: "Dispara sincronização completa de uma fonte (pode dar timeout em fontes grandes)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
        ],
        responses: {
          "200": {
            description: "Sincronização concluída",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                    },
                    result: {
                      type: "object",
                      properties: {
                        sourceId: { type: "string" },
                        added: { type: "integer" },
                        updated: { type: "integer" },
                        deleted: { type: "integer" },
                        duration: { type: "integer" },
                        errors: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "Fonte não encontrada",
          },
          "500": {
            description: "Erro na sincronização",
          },
        },
      },
    },
    "/api/search": {
      post: {
        tags: ["Search"],
        summary: "Busca semântica/híbrida",
        description: "Realiza busca vetorial com suporte a filtros e paginação",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: {
                    type: "string",
                    description: "Texto da busca",
                    example: "machine learning",
                  },
                  sourceSlugs: {
                    type: "array",
                    items: { type: "string" },
                    description: "Slugs das fontes para filtrar (opcional)",
                    example: ["blog-posts", "documentation"],
                  },
                  limit: {
                    type: "integer",
                    default: 10,
                    minimum: 1,
                    maximum: 200,
                    description: "Número de resultados por página",
                  },
                  offset: {
                    type: "integer",
                    default: 0,
                    minimum: 0,
                    description: "Offset para paginação",
                  },
                  searchType: {
                    type: "string",
                    enum: ["vector", "hybrid"],
                    default: "hybrid",
                    description: "Tipo de busca",
                  },
                  hybridAlpha: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    default: 0.5,
                    description: "Peso da busca vetorial (0=só texto, 1=só vetorial)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Resultados da busca",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/SearchResult",
                      },
                    },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Parâmetros inválidos",
          },
        },
      },
    },
    "/api/stats": {
      get: {
        tags: ["Stats"],
        summary: "Estatísticas gerais",
        description: "Retorna estatísticas do sistema",
        responses: {
          "200": {
            description: "Estatísticas",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalSources: { type: "integer" },
                    totalItems: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/usage": {
      get: {
        tags: ["Stats"],
        summary: "Uso de embeddings",
        description: "Retorna uso diário de embeddings",
        responses: {
          "200": {
            description: "Uso de embeddings",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    usage: {
                      type: "object",
                      properties: {
                        date: { type: "string", format: "date" },
                        used: { type: "integer" },
                        limit: { type: "integer" },
                        remaining: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/sync-progress": {
      get: {
        tags: ["Sync"],
        summary: "Progresso do sync chunked",
        description: "Retorna progresso da última sessão de sync chunked",
        responses: {
          "200": {
            description: "Progresso da sincronização",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    session: {
                      type: "object",
                      nullable: true,
                      properties: {
                        id: { type: "string", format: "uuid" },
                        status: {
                          type: "string",
                          enum: ["running", "completed", "failed", "partial"],
                        },
                        progress: { type: "integer" },
                        totalChunks: { type: "integer" },
                        completedChunks: { type: "integer" },
                        failedChunks: { type: "integer" },
                        totalItemsAdded: { type: "integer" },
                        totalItemsUpdated: { type: "integer" },
                        totalItemsDeleted: { type: "integer" },
                        createdAt: { type: "string", format: "date-time" },
                        completedAt: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/cron/sync-start": {
      get: {
        tags: ["Sync"],
        summary: "Iniciar sync chunked (Cron)",
        description: "Inicia uma nova sessão de sincronização chunked. Requer autenticação via CRON_SECRET.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Sync iniciado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    sessionId: { type: "string", format: "uuid" },
                    totalChunks: { type: "integer" },
                    nextUrl: { type: "string" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Não autorizado",
          },
        },
      },
    },
    "/api/cron/sync-chunk": {
      get: {
        tags: ["Sync"],
        summary: "Processar chunk (Cron)",
        description: "Processa um chunk da fila de sincronização. Requer autenticação via CRON_SECRET.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Chunk processado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    completed: { type: "boolean" },
                    itemsProcessed: { type: "integer" },
                    itemsAdded: { type: "integer" },
                    itemsUpdated: { type: "integer" },
                    itemsDeleted: { type: "integer" },
                    nextUrl: { type: "string" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Não autorizado",
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "CRON_SECRET para endpoints de sincronização",
      },
    },
    schemas: {
      DataSource: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
          name: { type: "string" },
          endpoint: { type: "string", format: "uri" },
          method: { type: "string", enum: ["GET", "POST"] },
          headers: { type: "object" },
          body: { type: "object" },
          queryParams: { type: "object" },
          arrayPath: { type: "string" },
          idPath: { type: "string" },
          contentPath: { type: "string" },
          contentTemplate: { type: "string", nullable: true },
          displayTemplate: { type: "string", nullable: true },
          pagination: { type: "object", nullable: true },
          transformScript: { type: "string", nullable: true },
          syncInterval: { type: "integer" },
          isActive: { type: "boolean" },
          itemCount: { type: "integer" },
          lastSync: { type: "string", format: "date-time", nullable: true },
          lastError: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      DataSourceInput: {
        type: "object",
        required: ["name", "endpoint", "method", "arrayPath", "idPath", "contentPath"],
        properties: {
          slug: { 
            type: "string", 
            pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            description: "URL-friendly identifier (auto-generated from name if not provided)"
          },
          name: { type: "string", minLength: 1 },
          endpoint: { type: "string", format: "uri" },
          method: { type: "string", enum: ["GET", "POST"] },
          headers: { type: "object" },
          body: { type: "object" },
          queryParams: { type: "object" },
          arrayPath: { type: "string" },
          idPath: { type: "string" },
          contentPath: { type: "string" },
          contentTemplate: { type: "string" },
          displayTemplate: { type: "string" },
          pagination: { type: "object" },
          transformScript: { type: "string" },
          syncInterval: { type: "integer", minimum: 1 },
          isActive: { type: "boolean" },
        },
      },
      SearchResult: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          sourceId: { type: "string", format: "uuid" },
          sourceName: { type: "string" },
          externalId: { type: "string" },
          content: { type: "string" },
          originalData: { type: "object" },
          transformedData: { type: "object", nullable: true },
          vectorScore: { type: "number", nullable: true },
          textScore: { type: "number", nullable: true },
          hybridScore: { type: "number", nullable: true },
          displayTemplate: { type: "string", nullable: true },
        },
      },
    },
  },
};
