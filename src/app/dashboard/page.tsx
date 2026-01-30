"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { DataSource } from "@/types";

export default function Dashboard() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [stats, setStats] = useState({ totalSources: 0, totalItems: 0 });
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    id: string;
    status: string;
    progress: number;
    totalChunks: number;
    completedChunks: number;
    failedChunks: number;
    totalItemsAdded: number;
    totalItemsUpdated: number;
    totalItemsDeleted: number;
    createdAt: string;
    completedAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    
    // Poll sync progress every 3 seconds
    const interval = setInterval(() => {
      fetchSyncProgress();
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [sourcesRes, statsRes, usageRes] = await Promise.all([
        fetch("/api/v1/sources"),
        fetch("/api/v1/stats"),
        fetch("/api/v1/usage"),
      ]);
      
      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        setSources(data.sources || []);
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(data.usage);
      }
      
      // Also fetch sync progress
      await fetchSyncProgress();
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncProgress = async () => {
    try {
      const res = await fetch("/api/v1/sync-progress");
      if (res.ok) {
        const data = await res.json();
        setSyncProgress(data.session);
      }
    } catch (error) {
      // Silently fail - sync progress is optional
    }
  };

  const syncSource = async (sourceId: string) => {
    setSyncing(sourceId);
    try {
      const res = await fetch(`/api/v1/sources/${sourceId}/sync-chunked`, { method: "POST" });
      if (res.ok) {
        // Refresh data immediately to start showing progress
        fetchData();
      } else {
        alert("Erro ao iniciar sincronização");
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
        fetchData();
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
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <div>
            <h1 className="display-5 fw-bold">Apoia-Vector</h1>
            <p className="lead text-muted mb-0">
              Sistema de indexação vetorial de fontes de dados REST
            </p>
          </div>
          <div>
            <Link href="/api-docs" className="btn btn-outline-secondary" target="_blank">
              <i className="bi bi-file-text me-2"></i>
              API Docs
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="row row-cols-1 row-cols-md-3 g-4 mb-4">
        <div className="col">
          <div className="card bg-primary text-white h-100">
            <div className="card-body">
              <h5 className="card-title">Fontes Configuradas</h5>
              <p className="display-6 mb-0">{stats.totalSources}</p>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card bg-success text-white h-100">
            <div className="card-body">
              <h5 className="card-title">Itens Indexados</h5>
              <p className="display-6 mb-0">{stats.totalItems?.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="col">
          <div className={`card h-100 ${usage && usage.limit > 0 && usage.remaining < usage.limit * 0.1 ? "bg-warning" : "bg-info"} text-white`}>
            <div className="card-body">
              <h5 className="card-title">Embeddings Hoje</h5>
              {usage ? (
                <p className="display-6 mb-0">{usage.used?.toLocaleString()}</p>
              ) : (
                <p className="display-6 mb-0">...</p>
              )}
            </div>
            {usage && (
              <div className="card-footer bg-transparent border-white border-opacity-25">
                {usage.limit > 0 ? (
                  <small>Limite: {usage.limit.toLocaleString()} | Restante: {usage.remaining.toLocaleString()}</small>
                ) : (
                  <small>Ilimitado</small>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Progress Card */}
      {syncProgress && syncProgress.status === "running" && (
        <div className="alert alert-info mb-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0">
              <i className="bi bi-arrow-repeat me-2"></i>
              Sincronização em Andamento
            </h6>
            <span className="badge bg-primary">{syncProgress.progress}%</span>
          </div>
          <div className="progress mb-2" style={{ height: "8px" }}>
            <div
              className="progress-bar progress-bar-striped progress-bar-animated"
              role="progressbar"
              style={{ width: `${syncProgress.progress}%` }}
              aria-valuenow={syncProgress.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <small className="text-muted">
            {syncProgress.completedChunks} de {syncProgress.totalChunks} páginas processadas
            {syncProgress.failedChunks > 0 && (
              <span className="text-danger ms-2">
                • {syncProgress.failedChunks} falhas
              </span>
            )}
            {syncProgress.totalItemsAdded > 0 && (
              <span className="text-success ms-2">
                • {syncProgress.totalItemsAdded} novos
              </span>
            )}
            {syncProgress.totalItemsUpdated > 0 && (
              <span className="text-warning ms-2">
                • {syncProgress.totalItemsUpdated} atualizados
              </span>
            )}
            {syncProgress.totalItemsDeleted > 0 && (
              <span className="text-danger ms-2">
                • {syncProgress.totalItemsDeleted} removidos
              </span>
            )}
          </small>
        </div>
      )}

      {/* Sources List */}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Fontes de Dados</h5>
          <Link href="/sources/new" className="btn btn-primary btn-sm">
            + Nova Fonte
          </Link>
        </div>
        <div className="card-body">
          {sources.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted mb-3">Nenhuma fonte configurada ainda.</p>
              <Link href="/sources/new" className="btn btn-primary">
                Configurar Primeira Fonte
              </Link>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Endpoint</th>
                    <th>Método</th>
                    <th>Itens</th>
                    <th>Última Sync</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.id}>
                      <td className="fw-medium">
                        {source.name}
                        {source.lastError && (
                          <div className="small text-danger mt-1">
                            <i className="bi bi-exclamation-triangle-fill me-1"></i>
                            {source.lastError}
                          </div>
                        )}
                      </td>
                      <td>
                        <code className="small">{source.endpoint}</code>
                      </td>
                      <td>
                        <span className={`badge ${source.method === "GET" ? "bg-success" : "bg-warning"}`}>
                          {source.method}
                        </span>
                      </td>
                      <td>{source.itemCount || 0}</td>
                      <td>
                        {source.lastSync
                          ? new Date(source.lastSync).toLocaleString("pt-BR")
                          : "Nunca"}
                      </td>
                      <td>
                        <span className={`badge ${source.isActive ? "bg-success" : "bg-secondary"}`}>
                          {source.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <Link href={`/sources/${source.id}`} className="btn btn-outline-primary">
                            Editar
                          </Link>
                          <button
                            className="btn btn-outline-success"
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
                            className="btn btn-outline-danger"
                            onClick={() => deleteSource(source.id, source.name)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
