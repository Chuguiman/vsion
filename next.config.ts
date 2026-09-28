import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres"],
  logging: {
    // No imprimir los argumentos de las server actions (p. ej. contraseñas del login).
    serverFunctions: false,
    // No reenviar la consola del navegador (diffs de hidratación con HTML) al terminal.
    browserToTerminal: false,
  },
  // JSON de cartera puede ser grande; permitir body mayor en server actions.
  // El proxy (middleware.ts) tiene su propio límite (10 MB por defecto) y trunca
  // el body antes de llegar a la action ("Unexpected end of form").
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
