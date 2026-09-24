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
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default nextConfig;
