"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function SignIn() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="container">
      <div className="row justify-content-center align-items-center" style={{ minHeight: "80vh" }}>
        <div className="col-md-6 col-lg-4">
          <div className="card shadow">
            <div className="card-body text-center p-5">
              <h1 className="h3 mb-4">🔍 Apoia-Vector</h1>
              <h2 className="h5 mb-4">Acesso Restrito</h2>
              
              {error && (
                <div className="alert alert-danger" role="alert">
                  <strong>Acesso negado:</strong> Seu email não está autorizado a acessar o dashboard.
                </div>
              )}
              
              <p className="text-muted mb-4">
                Faça login com sua conta Google autorizada para acessar o dashboard.
              </p>
              
              <button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="btn btn-primary btn-lg w-100"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="20" 
                  height="20" 
                  fill="currentColor" 
                  className="bi bi-google me-2" 
                  viewBox="0 0 16 16"
                >
                  <path d="M15.545 6.558a9.4 9.4 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.7 7.7 0 0 1 5.352 2.082l-2.284 2.284A4.35 4.35 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.8 4.8 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.7 3.7 0 0 0 1.599-2.431H8v-3.08z"/>
                </svg>
                Entrar com Google
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
