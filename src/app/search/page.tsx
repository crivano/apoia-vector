"use client";

import { useState, useEffect } from "react";
import type { DataSource, SearchResponse, SearchResult, SearchMode } from "@/types";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<DataSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const [threshold, setThreshold] = useState(0.3);
  const [searchMode, setSearchMode] = useState<SearchMode>("hybrid");
  const [vectorWeight, setVectorWeight] = useState(0.7);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const res = await fetch("/api/v1/sources");
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      }
    } catch (error) {
      console.error("Erro ao carregar fontes:", error);
    }
  };

  const handleSearch = async (page = 1) => {
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch("/api/v1/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          sourceIds: selectedSources.length > 0 ? selectedSources : undefined,
          limit: pagination.pageSize,
          offset: (page - 1) * pagination.pageSize,
          threshold,
          mode: searchMode,
          vectorWeight,
        }),
      });

      if (res.ok) {
        const data: SearchResponse = await res.json();
        setResults(data.results);
        setPagination({
          page: data.page,
          pageSize: data.pageSize,
          total: data.total,
          totalPages: data.totalPages,
        });
      }
    } catch (error) {
      console.error("Erro na busca:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = (sourceId: string) => {
    setSelectedSources((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const formatSimilarity = (similarity: number) => {
    return `${(similarity * 100).toFixed(1)}%`;
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="h2 mb-1">Busca Semântica</h1>
        <p className="text-muted mb-0">Encontre conteúdo similar usando busca vetorial</p>
      </div>

      {/* Search Form */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">Consulta</label>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control form-control-lg"
                  placeholder="Digite sua busca..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleSearch()}
                  disabled={loading || !query.trim()}
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    "Buscar"
                  )}
                </button>
              </div>
            </div>

            <div className="col-md-8">
              <label className="form-label">Filtrar por Fontes</label>
              <div className="d-flex flex-wrap gap-2">
                {sources.map((source) => (
                  <button
                    key={source.id}
                    className={`btn btn-sm ${
                      selectedSources.includes(source.id)
                        ? "btn-primary"
                        : "btn-outline-secondary"
                    }`}
                    onClick={() => toggleSource(source.id)}
                  >
                    {source.name}
                  </button>
                ))}
                {sources.length === 0 && (
                  <span className="text-muted">Nenhuma fonte disponível</span>
                )}
              </div>
            </div>

            <div className="col-md-4">
              <label className="form-label">Modo de Busca</label>
              <select
                className="form-select"
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as SearchMode)}
              >
                <option value="hybrid">Híbrida (Vetor + Texto)</option>
                <option value="vector">Vetorial (Semântica)</option>
                <option value="fulltext">Texto Completo (Exata)</option>
              </select>
            </div>

            {searchMode === "hybrid" && (
              <div className="col-md-6">
                <label className="form-label">
                  Peso: Vetor {(vectorWeight * 100).toFixed(0)}% / Texto {((1 - vectorWeight) * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  className="form-range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={vectorWeight}
                  onChange={(e) => setVectorWeight(parseFloat(e.target.value))}
                />
                <small className="text-muted">
                  Mais vetor = busca semântica. Mais texto = termos exatos.
                </small>
              </div>
            )}

            {searchMode !== "fulltext" && (
              <div className={searchMode === "hybrid" ? "col-md-6" : "col-md-4"}>
                <label className="form-label">
                  Similaridade Mínima: {(threshold * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  className="form-range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="mt-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Resultados</h5>
            <span className="badge bg-secondary">
              {pagination.total} encontrado{pagination.total !== 1 ? "s" : ""}
            </span>
          </div>
          <div>
            {results.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted mb-0">
                  Nenhum resultado encontrado para &quot;{query}&quot;
                </p>
              </div>
            ) : (
              <div className="list-group">
                {results.map((result, index) => (
                  <div key={result.item.id} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-light text-dark">
                          #{(pagination.page - 1) * pagination.pageSize + index + 1}
                        </span>
                        {result.source && (
                          <span className="badge bg-info">{result.source.name}</span>
                        )}
                      </div>
                      <div className="d-flex gap-2 align-items-center">
                        {searchMode === "hybrid" && (
                          <>
                            {result.vectorScore !== undefined && (
                              <span className="badge bg-primary" title="Score Vetorial (similaridade semântica)">
                                V: {(result.vectorScore * 100).toFixed(0)}%
                              </span>
                            )}
                            {result.textScore !== undefined && (
                              <span className={`badge ${result.textScore > 0 ? "bg-warning text-dark" : "bg-light text-muted"}`} title="Score Texto (match de palavras)">
                                T: {(result.textScore * 100).toFixed(0)}%
                              </span>
                            )}
                          </>
                        )}
                        <span className={`badge similarity-badge ${
                          result.similarity >= 0.9 ? "bg-success" :
                          result.similarity >= 0.8 ? "bg-primary" :
                          result.similarity >= 0.7 ? "bg-warning" : "bg-secondary"
                        }`} title={searchMode === "hybrid" ? "Score Combinado (V×peso + T×peso)" : "Score"}>
                          {searchMode === "hybrid" ? "C: " : ""}{formatSimilarity(result.similarity)}
                        </span>
                      </div>
                    </div>

                    <p className="mb-2">{result.item.content}</p>

                    <div className="d-flex justify-content-between align-items-center">
                      <small className="text-muted">
                        ID: {result.item.externalId}
                      </small>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() =>
                          setExpandedItem(
                            expandedItem === result.item.id ? null : result.item.id
                          )
                        }
                      >
                        {expandedItem === result.item.id ? "Ocultar JSON" : "Ver JSON"}
                      </button>
                    </div>

                    {expandedItem === result.item.id && (
                      <div className="json-preview mt-3">
                        <pre className="mb-0">
                          {JSON.stringify(
                            result.item.data,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}n              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4">
              <nav>
                <ul className="pagination justify-content-center mb-0">
                  <li className={`page-item ${pagination.page === 1 ? "disabled" : ""}`}>
                    <button
                      className="page-link"
                      onClick={() => handleSearch(1)}
                      disabled={pagination.page === 1}
                      title="Primeira página"
                    >
                      «
                    </button>
                  </li>
                  <li className={`page-item ${pagination.page === 1 ? "disabled" : ""}`}>
                    <button
                      className="page-link"
                      onClick={() => handleSearch(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      Anterior
                    </button>
                  </li>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <li
                        key={pageNum}
                        className={`page-item ${pagination.page === pageNum ? "active" : ""}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => handleSearch(pageNum)}
                        >
                          {pageNum}
                        </button>
                      </li>
                    );
                  })}
                  <li className={`page-item ${pagination.page === pagination.totalPages ? "disabled" : ""}`}>
                    <button
                      className="page-link"
                      onClick={() => handleSearch(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      Próxima
                    </button>
                  </li>
                  <li className={`page-item ${pagination.page === pagination.totalPages ? "disabled" : ""}`}>
                    <button
                      className="page-link"
                      onClick={() => handleSearch(pagination.totalPages)}
                      disabled={pagination.page === pagination.totalPages}
                      title="Última página"
                    >
                      »
                    </button>
                  </li>
                </ul>
              </nav>
              <div className="text-center mt-2 pagination-info">
                Mostrando {(pagination.page - 1) * pagination.pageSize + 1} -{" "}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} de{" "}
                {pagination.total}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
