"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

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
                Dashboard
              </Link>
            </li>
            <li className="nav-item">
              <Link 
                href="/sources" 
                className={`nav-link ${isActive("/sources") ? "active" : ""}`}
              >
                Fontes
              </Link>
            </li>
            <li className="nav-item">
              <Link 
                href="/search" 
                className={`nav-link ${isActive("/search") ? "active" : ""}`}
              >
                Busca
              </Link>
            </li>
          </ul>
          
          <div className="d-flex">
            <Link href="/sources/new" className="btn btn-outline-light btn-sm">
              + Nova Fonte
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
