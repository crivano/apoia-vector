import type { Knex } from "knex";

// Initial data sources to seed if table is empty
const INITIAL_SOURCES = [
  {
    id: "0ae8e83f-7ebe-4a29-8a88-95342842c59b",
    slug: "stj-rr",
    name: "STJ - Recursos Especiais Repetitivos",
    description: null,
    endpoint: "https://pangeabnp.pdpj.jus.br/api/v1/precedentes",
    method: "POST",
    headers: {},
    body: {
      filtro: {
        nr: "",
        tipos: ["RR"],
        orgaos: ["STJ"],
        ordenacao: "Text",
        buscaGeral: "",
        cancelados: false,
        semPalavras: "",
        trechoExato: "",
        todasPalavras: "",
        atualizacaoAte: "",
        atualizacaoDesde: "",
        quaisquerPalavras: "",
      },
    },
    query_params: {},
    array_path: "$.resultados",
    id_path: "$.id",
    content_path: "$.questao",
    content_template: null,
    title_template: "Tema {{nr}}/STJ",
    display_template:
      '<div><strong>Recurso Especial Repetitivo {{nr}}</strong> - <span class="text-primary">{{questao}}</span>\n{% if tese %}<div class="mt-2"><strong>Tese</strong>: <span class="text-info">{{tese}}</span></div>{% endif %}\n{% for suspensao in suspensoes %}\n    {% if suspensao.ativa %}\n        <div class="mt-2"><strong>Suspensão</strong>: <span class="text-warning">{{suspensao.descricao}} ({{suspensao.dataSuspensao}})</span></div>\n    {% endif %}\n{% endfor %}\n{% if situacao %}<div class="mt-2"><strong>Situação</strong>: <span class="text-dark">{{situacao}}</span></div>{% endif %}\n</div>',
    pagination: {
      type: "page",
      limit: 100,
      location: "body",
      pageParam: "$.filtro.pagina",
      limitParam: "$.filtro.tamanhoPagina",
    },
    transform_script:
      "return {...item, processosParadigma: undefined, highlight: undefined}",
    sync_interval: 60,
    is_active: true,
    last_sync: null,
    last_error: null,
    item_count: 0,
  },
  {
    id: "ba61b168-6632-4447-8d0a-6fd578e49a88",
    slug: "stf-rg",
    name: "STF - Temas de Repercussão Geral",
    description: null,
    endpoint: "https://pangeabnp.pdpj.jus.br/api/v1/precedentes",
    method: "POST",
    headers: {},
    body: {
      filtro: {
        nr: "",
        tipos: ["RG"],
        orgaos: ["STF"],
        ordenacao: "Text",
        buscaGeral: "",
        cancelados: false,
        semPalavras: "",
        trechoExato: "",
        todasPalavras: "",
        atualizacaoAte: "",
        atualizacaoDesde: "",
        quaisquerPalavras: "",
      },
    },
    query_params: {},
    array_path: "$.resultados",
    id_path: "$.id",
    content_path: "$.questao",
    content_template: null,
    title_template: "Tema {{nr}}/STF",
    display_template:
      '<div><strong>Tema de Repercussão Geral {{nr}}</strong> - <span class="text-primary">{{questao}}</span>\n{% if tese %}<div class="mt-2"><strong>Tese</strong>: <span class="text-info">{{tese}}</span></div>{% endif %}\n{% for suspensao in suspensoes %}\n    {% if suspensao.ativa %}\n        <div class="mt-2"><strong>Suspensão</strong>: <span class="text-warning">{{suspensao.descricao}} ({{suspensao.dataSuspensao}})</span></div>\n    {% endif %}\n{% endfor %}\n{% if situacao %}<div class="mt-2"><strong>Situação</strong>: <span class="text-dark">{{situacao}}</span></div>{% endif %}\n</div>',
    pagination: {
      type: "page",
      limit: 100,
      location: "body",
      pageParam: "$.filtro.pagina",
      limitParam: "$.filtro.tamanhoPagina",
    },
    transform_script:
      "return {...item, processosParadigma: undefined, highlight: undefined}",
    sync_interval: 60,
    is_active: true,
    last_sync: null,
    last_error: null,
    item_count: 0,
  },
];

export async function up(knex: Knex): Promise<void> {
  // Check if table already has data
  const count = await knex("data_sources").count("* as count").first();
  const hasData = count && parseInt(count.count as string, 10) > 0;

  // Only insert if table is empty
  if (!hasData) {
    await knex("data_sources").insert(INITIAL_SOURCES);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Get the IDs of initial sources
  const initialIds = INITIAL_SOURCES.map((s) => s.id);

  // Fetch current records with these IDs
  const currentRecords = await knex("data_sources")
    .whereIn("id", initialIds)
    .select("*");

  // Only delete if records haven't been modified
  // We compare key fields to determine if they're unchanged
  for (const record of currentRecords) {
    const initialSource = INITIAL_SOURCES.find((s) => s.id === record.id);
    
    if (!initialSource) continue;

    // Check if critical fields remain unchanged
    const isUnchanged =
      record.slug === initialSource.slug &&
      record.name === initialSource.name &&
      record.endpoint === initialSource.endpoint &&
      record.method === initialSource.method &&
      JSON.stringify(record.body) === JSON.stringify(initialSource.body) &&
      record.array_path === initialSource.array_path &&
      record.id_path === initialSource.id_path &&
      record.content_path === initialSource.content_path &&
      record.transform_script === initialSource.transform_script;

    // Only delete if unchanged
    if (isUnchanged) {
      await knex("data_sources").where("id", record.id).delete();
    }
  }
}
