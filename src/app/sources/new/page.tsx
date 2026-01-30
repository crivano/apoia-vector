"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SourceForm from "@/components/SourceForm";
import type { DataSource } from "@/types";

export default function NewSourcePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: Partial<DataSource>) => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        router.push("/sources");
      } else {
        const result = await res.json();
        setError(result.error || "Erro ao criar fonte");
      }
    } catch (err) {
      setError("Erro ao criar fonte");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="h2 mb-1">Nova Fonte de Dados</h1>
        <p className="text-muted mb-0">Configure uma nova fonte de dados REST para indexação</p>
      </div>

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      <SourceForm onSubmit={handleSubmit} saving={saving} />
    </div>
  );
}
