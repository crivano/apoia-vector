"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { DataSource } from "@/types";

export default function SourcesPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  const syncSource = async (sourceId: string) => {
    setSyncing(sourceId);
    try {
      const res = await fetch(`/api/v1/sources/${sourceId}/sync`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        alert(`Sincronização concluída!\nAdicionados: ${data.result.added}\nAtualizados: ${data.result.updated}\nRemovidos: ${data.result.deleted}`);
        fetchSources();
      }
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      alert("Erro ao sincronizar fonte");
    } finally {
      setSyncing(null);
    }
  };

  const deleteSource = async (sourceId: string, sourceName: string) => {
    if (!confirm(`Tem certeza que deseja excluir a fonte "${sourceName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/sources/${sourceId}`, { method: "DELETE" });
      if (res.ok) {
        fetchSources();
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir fonte");
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "50vh" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h2 mb-1">Fontes de Dados</h1>
          <p className="text-muted mb-0">Gerencie suas fontes de dados REST</p>
        </div>
        <Link href="/sources/new" className="btn btn-primary">
          + Nova Fonte
        </Link>
      </div>

      {sources.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <h5 className="text-muted mb-3">Nenhuma fonte configurada</h5>
            <p className="text-muted mb-4">
              Configure sua primeira fonte de dados para começar a indexar conteúdo.
            </p>
            <Link href="/sources/new" className="btn btn-primary">
              Configurar Primeira Fonte
            </Link>
          </div>
        </div>
      ) : (
        <div className="row">
          {sources.map((source) => (
            <div key={source.id} className="col-md-6 col-lg-4 mb-4">
              <div className="card source-card h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className="card-title mb-0">{source.name}</h5>
                    <span className={`badge ${source.isActive ? "bg-success" : "bg-secondary"}`}>
                      {source.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  
                  {source.description && (
                    <p className="card-text text-muted small mb-2">{source.description}</p>
                  )}

                  <div className="mb-3">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className={`badge ${source.method === "GET" ? "bg-success" : "bg-warning"}`}>
                        {source.method}
                      </span>
                      <code className="small text-truncate" style={{ maxWidth: "200px" }}>
                        {source.endpoint}
                      </code>
                    </div>
                  </div>

                  <div className="row text-center mb-3">
                    <div className="col-6">
                      <div className="small text-muted">Itens</div>
                      <div className="fw-bold">{source.itemCount || 0}</div>
                    </div>
                    <div className="col-6">
                      <div className="small text-muted">Intervalo</div>
                      <div className="fw-bold">{source.syncInterval}min</div>
                    </div>
                  </div>

                  {source.lastSync && (
                    <div className="small text-muted mb-3">
                      Última sync: {new Date(source.lastSync).toLocaleString("pt-BR")}
                    </div>
                  )}

                  {source.lastError && (
                    <div className="alert alert-danger py-1 px-2 small mb-3">
                      {source.lastError}
                    </div>
                  )}
                </div>
                
                <div className="card-footer bg-transparent">
                  <div className="btn-group w-100">
                    <Link href={`/sources/${source.id}`} className="btn btn-outline-primary btn-sm">
                      Editar
                    </Link>
                    <button
                      className="btn btn-outline-success btn-sm"
                      onClick={() => syncSource(source.id)}
                      disabled={syncing === source.id}
                    >
                      {syncing === source.id ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : (
                        "Sync"
                      )}
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => deleteSource(source.id, source.name)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
