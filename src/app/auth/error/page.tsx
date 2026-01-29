"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function AuthError() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="container">
      <div className="row justify-content-center align-items-center" style={{ minHeight: "80vh" }}>
        <div className="col-md-6 col-lg-5">
          <div className="card shadow border-danger">
            <div className="card-body text-center p-5">
              <div className="text-danger mb-4">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="64" 
                  height="64" 
                  fill="currentColor" 
                  className="bi bi-exclamation-triangle" 
                  viewBox="0 0 16 16"
                >
                  <path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057m1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767z"/>
                  <path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>
                </svg>
              </div>
              
              <h1 className="h3 mb-4">Acesso Negado</h1>
              
              {error === "AccessDenied" && (
                <div className="alert alert-danger" role="alert">
                  Seu email não está autorizado a acessar o dashboard do Apoia-Vector.
                </div>
              )}
              
              {error === "Configuration" && (
                <div className="alert alert-warning" role="alert">
                  Erro de configuração. Entre em contato com o administrador.
                </div>
              )}
              
              {!error && (
                <div className="alert alert-danger" role="alert">
                  Ocorreu um erro durante a autenticação.
                </div>
              )}
              
              <p className="text-muted mb-4">
                Se você acredita que deveria ter acesso, entre em contato com o administrador do sistema.
              </p>
              
              <Link href="/" className="btn btn-primary">
                Voltar para a Busca
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
