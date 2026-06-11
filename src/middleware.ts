import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/auth";

// Beschermt de volledige app: zonder geldige sessie geen toegang tot pagina's
// of API-routes (en dus geen image-generatie). De login-route zelf blijft open.
const PUBLIC_PATHS = ["/login", "/api/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (await isValidSession(token)) {
    return NextResponse.next();
  }

  // API-routes krijgen een nette 401 i.p.v. een redirect.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Niet ingelogd.", kind: "auth" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname && pathname !== "/" ? `?from=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Alles behalve Next-interne assets en het favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
