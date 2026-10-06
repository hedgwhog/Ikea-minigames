import { NextResponse } from "next/server";

export function proxy(request) {
  const code = request.nextUrl.pathname.split("/")[2] ?? "";
  const url = request.nextUrl.clone();
  if (!/^[a-z]{4}$/i.test(code)) {     // Checks for valid roomID
    url.pathname = "/"; 
    url.search = "?error=no-room"; 
    return NextResponse.redirect(url);
  }
  if (code !== code.toUpperCase()) {
    url.pathname = `/room/${code.toUpperCase()}`;    // The proxy only matches with urls starting with '/room' + in all upper case
    return NextResponse.redirect(url);
  }
  return NextResponse.next();   // If all alright, continue to the actual page
}

export const config = { matcher: "/room/:code*" };
