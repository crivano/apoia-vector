"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { DataSource } from "@/types";

export default function Dashboard() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [stats, setStats] = useState({ totalSources: 0, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sourcesRes, statsRes] = await Promise.all([
        fetch("/api/sources"),
        fetch("/api/stats"),
      ]);
      
      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        setSources(data.sources || []);
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncSource = async (sourceId: string) => {
    setSyncing(sourceId);
    try {
      const res = await fetch(`/api/sources/${sourceId}/sync`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        alert(`Sincronização concluída!\nAdicionados: ${data.result.added}\nAtualizados: ${data.result.updated}\nRemovidos: ${data.result.deleted}`);
        fetchData();
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
      const res = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
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
        <div className="col-12">
          <h1 className="display-5 fw-bold">Apoia-Vector</h1>
          <p className="lead text-muted">
            Sistema de indexação vetorial de fontes de dados REST
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card bg-primary text-white">
            <div className="card-body">
              <h5 className="card-title">Fontes Configuradas</h5>
              <p className="display-6 mb-0">{stats.totalSources}</p>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card bg-success text-white">
            <div className="card-body">
              <h5 className="card-title">Itens Indexados</h5>
              <p className="display-6 mb-0">{stats.totalItems}</p>
            </div>
          </div>
        </div>
      </div>

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
