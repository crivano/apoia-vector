"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import SourceForm from "@/components/SourceForm";
import type { DataSource } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditSourcePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [source, setSource] = useState<DataSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSource();
  }, [id]);

  const fetchSource = async () => {
    try {
      const res = await fetch(`/api/v1/sources/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSource(data.source);
      } else {
        setError("Fonte não encontrada");
      }
    } catch (err) {
      setError("Erro ao carregar fonte");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: Partial<DataSource>) => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/sources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        router.push("/sources");
      } else {
        const result = await res.json();
        setError(result.error || "Erro ao atualizar fonte");
      }
    } catch (err) {
      setError("Erro ao atualizar fonte");
      console.error(err);
    } finally {
      setSaving(false);
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

  if (!source) {
    return (
      <div className="alert alert-danger">
        {error || "Fonte não encontrada"}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="h2 mb-1">Editar Fonte de Dados</h1>
        <p className="text-muted mb-0">{source.name}</p>
      </div>

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      <SourceForm source={source} onSubmit={handleSubmit} saving={saving} />
    </div>
  );
}
