"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        <Link href="/" className="navbar-brand">
          <span className="me-2">🔍</span>
          Apoia-Vector
        </Link>
        
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link 
                href="/" 
                className={`nav-link ${isActive("/") && pathname === "/" ? "active" : ""}`}
              >
                Busca
              </Link>
            </li>
            {session && (
              <li className="nav-item">
                <Link 
                  href="/dashboard" 
                  className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}
                >
                  Dashboard
                </Link>
              </li>
            )}
          </ul>
          
          <div className="d-flex align-items-center">
            {status === "loading" ? (
              <span className="navbar-text text-light">Carregando...</span>
            ) : session ? (
              <div className="d-flex align-items-center">
                <span className="navbar-text text-light me-3">
                  {session.user?.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="btn btn-outline-light btn-sm"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="btn btn-outline-light btn-sm"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
