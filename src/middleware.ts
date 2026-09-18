import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Inline (no importar auth.ts: usa next/headers, no válido en edge middleware)
const SESSION_COOKIE = "vsion_session";
type Role = "superadmin" | "admin" | "user";

const PUBLIC = ["/login", "/register"];
const SUPERADMIN_ONLY = ["/cartera"]; // "/" se maneja aparte (es la página de subir)
const ADMIN_PATHS = ["/admin", "/paises", "/billing"];

async function readRole(req: NextRequest): Promise<Role | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return payload.role as Role;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = await readRole(req);
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // No autenticado
  if (!role) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Autenticado en páginas públicas → a su inicio
  if (isPublic) {
    return NextResponse.redirect(new URL(role === "superadmin" ? "/" : "/historial", req.url));
  }

  // Subir datos (home y cartera) → solo superadmin
  const isUpload = pathname === "/" || SUPERADMIN_ONLY.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isUpload && role !== "superadmin") {
    return NextResponse.redirect(new URL("/historial", req.url));
  }

  // Panel admin (usuarios, países, billing) → admin o superadmin
  const isAdmin = ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isAdmin && role !== "superadmin" && role !== "admin") {
    return NextResponse.redirect(new URL("/historial", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
