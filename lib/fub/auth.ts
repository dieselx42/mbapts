import type { NextRequest } from "next/server";

export function isFubProxyAuthorized(request: NextRequest): boolean {
  const expectedToken = process.env.FUB_PROXY_TOKEN?.trim();
  if (!expectedToken) return true;

  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token === expectedToken;
}
