import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

const PROTECTED = [
  "/dashboard",
  "/desprendibles",
  "/colaboradores",
  "/historial",
  "/templates",
  "/certificates",
  "/asistencia",
  "/cartera",
];

export default auth((req) => {
  const isAuthed = !!req.auth;
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (needsAuth && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
