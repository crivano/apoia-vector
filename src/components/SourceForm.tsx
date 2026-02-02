"use client";

import { useState } from "react";
import Link from "next/link";
import type { DataSource, PaginationConfig } from "@/types";

interface SourceFormProps {
  source?: DataSource;
  onSubmit: (data: Partial<DataSource>) => Promise<void>;
  saving: boolean;
}

export default function SourceForm({ source, onSubmit, saving }: SourceFormProps) {
  const [formData, setFormData] = useState({
    name: source?.name || "",
    slug: source?.slug || "",
    description: source?.description || "",
    endpoint: source?.endpoint || "",
    method: source?.method || "GET",
    headers: JSON.stringify(source?.headers || {}, null, 2),
    body: JSON.stringify(source?.body || {}, null, 2),
    queryParams: JSON.stringify(source?.queryParams || {}, null, 2),
    arrayPath: source?.arrayPath || "$.data",
    idPath: source?.idPath || "$.id",
    contentPath: source?.contentPath || "$.content",
    contentTemplate: source?.contentTemplate || "",
    titleTemplate: source?.titleTemplate || "",
    displayTemplate: source?.displayTemplate || "",
    usePagination: !!source?.pagination,
    paginationType: source?.pagination?.type || "page",
    paginationLocation: source?.pagination?.location || "query",
    pageParam: source?.pagination?.pageParam || "page",
    limitParam: source?.pagination?.limitParam || "limit",
    limit: source?.pagination?.limit || 100,
    cursorPath: source?.pagination?.cursorPath || "",
    transformScript: source?.transformScript || "",
    syncInterval: source?.syncInterval || 60,
    isActive: source?.isActive !== false,
  });

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    data?: unknown;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const pagination: PaginationConfig | undefined = formData.usePagination
        ? {
            type: formData.paginationType as "offset" | "page" | "cursor",
            location: formData.paginationLocation as "query" | "body",
            pageParam: formData.pageParam,
            limitParam: formData.limitParam,
            limit: formData.limit,
            cursorPath: formData.cursorPath || undefined,
          }
        : undefined;

      await onSubmit({
        name: formData.name,
        slug: formData.slug || undefined,
        description: formData.description || undefined,
        endpoint: formData.endpoint,
        method: formData.method as "GET" | "POST",
        headers: JSON.parse(formData.headers || "{}"),
        body: JSON.parse(formData.body || "{}"),
        queryParams: JSON.parse(formData.queryParams || "{}"),
        arrayPath: formData.arrayPath,
        idPath: formData.idPath,
        contentPath: formData.contentPath,
        contentTemplate: formData.contentTemplate || undefined,
        titleTemplate: formData.titleTemplate || undefined,
        displayTemplate: formData.displayTemplate || undefined,
        pagination,
        transformScript: formData.transformScript || undefined,
        syncInterval: formData.syncInterval,
        isActive: formData.isActive,
      });
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      let headers: Record<string, string>;
      let queryParams: Record<string, string>;

      try {
        headers = JSON.parse(formData.headers || "{}");
      } catch {
        setTestResult({ success: false, message: "Headers JSON inválido" });
        setTesting(false);
        return;
      }

      try {
        queryParams = JSON.parse(formData.queryParams || "{}");
      } catch {
        setTestResult({ success: false, message: "Query Params JSON inválido" });
        setTesting(false);
        return;
      }

      const url = new URL(formData.endpoint);
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value);
      }

      const response = await fetch(url.toString(), {
        method: formData.method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: formData.method === "POST" ? formData.body : undefined,
      });

      if (!response.ok) {
        setTestResult({
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
        return;
      }

      const data = await response.json();
      setTestResult({
        success: true,
        message: "Conexão bem sucedida!",
        data,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Erro: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="config-form">
      <div className="row">
        <div className="col-lg-8">
          {/* Basic Info */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">Informações Básicas</h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Nome *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Ex: Temas STF"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Slug</label>
                  <input
                    type="text"
                    className="form-control"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                    placeholder="Ex: temas-stf (gerado automaticamente se não informado)"
                  />
                  <small className="text-muted">
                    Identificador único em lowercase com hífens. Deixe em branco para gerar automaticamente.
                  </small>
                </div>
                <div className="col-12">
                  <label className="form-label">Descrição</label>
                  <input
                    type="text"
                    className="form-control"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Descrição opcional"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Endpoint Config */}
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Configuração do Endpoint</h5>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={testConnection}
                disabled={testing || !formData.endpoint}
              >
                {testing ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  "Testar Conexão"
                )}
              </button>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-2">
                  <label className="form-label">Método</label>
                  <select
                    className="form-select"
                    name="method"
                    value={formData.method}
                    onChange={handleChange}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
                <div className="col-md-10">
                  <label className="form-label">URL do Endpoint *</label>
                  <input
                    type="url"
                    className="form-control"
                    name="endpoint"
                    value={formData.endpoint}
                    onChange={handleChange}
                    required
                    placeholder="https://api.exemplo.com/dados"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Headers (JSON)</label>
                  <textarea
                    className="form-control font-monospace"
                    name="headers"
                    value={formData.headers}
                    onChange={handleChange}
                    rows={3}
                    placeholder='{"Authorization": "Bearer token"}'
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Query Params (JSON)</label>
                  <textarea
                    className="form-control font-monospace"
                    name="queryParams"
                    value={formData.queryParams}
                    onChange={handleChange}
                    rows={3}
                    placeholder='{"format": "json"}'
                  />
                </div>
                {formData.method === "POST" && (
                  <div className="col-12">
                    <label className="form-label">Body (JSON)</label>
                    <textarea
                      className="form-control font-monospace"
                      name="body"
                      value={formData.body}
                      onChange={handleChange}
                      rows={4}
                      placeholder='{"filtro": "todos"}'
                    />
                  </div>
                )}
              </div>

              {testResult && (
                <div className={`alert ${testResult.success ? "alert-success" : "alert-danger"} mt-3`}>
                  <strong>{testResult.success ? "✓" : "✗"}</strong> {testResult.message}
                  {testResult.data !== undefined && testResult.data !== null && (
                    <details className="mt-2">
                      <summary>Ver resposta</summary>
                      <pre className="mt-2 mb-0 small">
                        {JSON.stringify(testResult.data, null, 2).slice(0, 1000)}
                        {JSON.stringify(testResult.data).length > 1000 && "..."}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* JSONPath Mapping */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">Mapeamento JSONPath</h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Caminho do Array *</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    name="arrayPath"
                    value={formData.arrayPath}
                    onChange={handleChange}
                    required
                    placeholder="$.data.items"
                  />
                  <div className="form-text">JSONPath para o array de itens</div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Caminho do ID *</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    name="idPath"
                    value={formData.idPath}
                    onChange={handleChange}
                    required
                    placeholder="$.id"
                  />
                  <div className="form-text">JSONPath para o ID de cada item</div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Caminho do Conteúdo *</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    name="contentPath"
                    value={formData.contentPath}
                    onChange={handleChange}
                    required
                    placeholder="$.descricao"
                  />
                  <div className="form-text">JSONPath para o texto a vetorizar</div>
                </div>
                <div className="col-12">
                  <label className="form-label">Template de Conteúdo (opcional)</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    name="contentTemplate"
                    value={formData.contentTemplate}
                    onChange={handleChange}
                    placeholder="Título: {{$.titulo}} - {{$.descricao}}"
                  />
                  <div className="form-text">
                    Use {`{{$.campo}}`} para combinar múltiplos campos no conteúdo
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label">Template de Título (opcional)</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    name="titleTemplate"
                    value={formData.titleTemplate}
                    onChange={handleChange}
                    placeholder="Tema {{nr}} - {{titulo}}"
                  />
                  <div className="form-text">
                    Template Nunjucks para gerar o título do item. Use {`{{campo}}`} para acessar campos do JSON
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label">Template de Exibição (opcional)</label>
                  <textarea
                    className="form-control font-monospace"
                    name="displayTemplate"
                    value={formData.displayTemplate}
                    onChange={handleChange}
                    rows={4}
                    placeholder={'<div><strong>{{$.titulo}}</strong><br>{{$.descricao}}</div>'}
                  />
                  <div className="form-text">
                    Template HTML para exibir o resultado na busca. Use {`{{$.campo}}`} para inserir valores do JSON.
                    Se vazio, será exibido apenas o conteúdo simples.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pagination */}
          <div className="card mb-4">
            <div className="card-header">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="usePagination"
                  name="usePagination"
                  checked={formData.usePagination}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="usePagination">
                  <h5 className="mb-0">Paginação</h5>
                </label>
              </div>
            </div>
            {formData.usePagination && (
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label">Tipo</label>
                    <select
                      className="form-select"
                      name="paginationType"
                      value={formData.paginationType}
                      onChange={handleChange}
                    >
                      <option value="page">Página (1, 2, 3...)</option>
                      <option value="offset">Offset (0, 100, 200...)</option>
                      <option value="cursor">Cursor</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Enviar em</label>
                    <select
                      className="form-select"
                      name="paginationLocation"
                      value={formData.paginationLocation}
                      onChange={handleChange}
                    >
                      <option value="query">Query String (URL)</option>
                      <option value="body">Body (POST)</option>
                    </select>
                    <small className="text-muted">
                      Onde os parâmetros de paginação serão enviados
                    </small>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Parâmetro de Página</label>
                    <input
                      type="text"
                      className="form-control"
                      name="pageParam"
                      value={formData.pageParam}
                      onChange={handleChange}
                      placeholder="page"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Parâmetro de Limite</label>
                    <input
                      type="text"
                      className="form-control"
                      name="limitParam"
                      value={formData.limitParam}
                      onChange={handleChange}
                      placeholder="limit"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Itens por Página</label>
                    <input
                      type="number"
                      className="form-control"
                      name="limit"
                      value={formData.limit}
                      onChange={handleChange}
                      min={1}
                      max={1000}
                    />
                  </div>
                  {formData.paginationType === "cursor" && (
                    <div className="col-12">
                      <label className="form-label">Caminho do Cursor</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        name="cursorPath"
                        value={formData.cursorPath}
                        onChange={handleChange}
                        placeholder="$.nextCursor"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Transform */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">Transformação (opcional)</h5>
            </div>
            <div className="card-body">
              <label className="form-label">Script de Transformação</label>
              <textarea
                className="form-control font-monospace"
                name="transformScript"
                value={formData.transformScript}
                onChange={handleChange}
                rows={6}
                placeholder={`// O item original está disponível como 'item'
// Retorne o objeto transformado
return {
  id: item.id,
  titulo: item.titulo,
  resumo: item.descricao.substring(0, 500)
};`}
              />
              <div className="form-text">
                JavaScript para transformar cada item antes de armazenar.
                Use <code>return</code> para retornar o objeto transformado.
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-lg-4">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">Configurações de Sync</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Intervalo de Sync (minutos)</label>
                <input
                  type="number"
                  className="form-control"
                  name="syncInterval"
                  value={formData.syncInterval}
                  onChange={handleChange}
                  min={1}
                />
              </div>
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="isActive">
                  Fonte ativa
                </label>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">Ações</h5>
            </div>
            <div className="card-body d-grid gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Salvando...
                  </>
                ) : (
                  source ? "Atualizar Fonte" : "Criar Fonte"
                )}
              </button>
              <Link href="/sources" className="btn btn-outline-secondary">
                Cancelar
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Ajuda</h5>
            </div>
            <div className="card-body small">
              <h6>JSONPath</h6>
              <p>Use expressões JSONPath para localizar dados:</p>
              <ul className="mb-3">
                <li><code>$.data</code> - Campo &quot;data&quot; na raiz</li>
                <li><code>$.items[*]</code> - Todos os itens do array</li>
                <li><code>$.resultado.lista</code> - Caminho aninhado</li>
              </ul>
              
              <h6>Template de Conteúdo</h6>
              <p>Combine campos usando {`{{$.campo}}`}:</p>
              <code className="d-block mb-3">
                {`{{$.titulo}} - {{$.descricao}}`}
              </code>

              <h6>Transformação</h6>
              <p>
                Use JavaScript para modificar os dados antes de armazenar.
                A variável <code>item</code> contém o JSON original.
              </p>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
