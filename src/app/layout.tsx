import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Apoia-Vector",
  description: "Sistema de indexação vetorial de fontes REST",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <Navbar />
        <main className="container py-4">
          {children}
        </main>
      </body>
    </html>
  );
}
