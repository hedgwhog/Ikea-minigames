// NEXT.JS MIDDLEWARE. (React has no "useMiddleware" hook; middleware is a Next.js feature.
// Since Next 16 the file is called proxy.js instead of middleware.js.)
// It runs BEFORE a room page renders:
//   /room/abcd  -> redirect to /room/ABCD (codes are upper case)
//   /room/hello -> not a room code, back to the homepage
// (Whether the room still exists is checked by the page itself.)
import { NextResponse } from "next/server";

export function proxy(request) {
  const code = request.nextUrl.pathname.split("/")[2] ?? "";
  const url = request.nextUrl.clone();
  if (!/^[a-z]{4}$/i.test(code)) {
    url.pathname = "/";
    url.search = "?error=no-room";
    return NextResponse.redirect(url);
  }
  if (code !== code.toUpperCase()) {
    url.pathname = `/room/${code.toUpperCase()}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: "/room/:code*" };
