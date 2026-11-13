import { env } from "cloudflare:workers";

export function GET() {
  return Response.json({ available: env.LOCAL_RECEIPT_OCR === "1" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (env.LOCAL_RECEIPT_OCR !== "1") return new Response(null, { status: 503 });
  if (req.headers.get("Origin") !== new URL(req.url).origin && req.headers.get("Origin")) return new Response(null, { status: 403 });
  if (req.headers.get("X-Receipt-Scan") !== "1") return new Response(null, { status: 400 });
  const length = Number(req.headers.get("Content-Length"));
  if (!length || length > 8 * 1024 * 1024) return new Response(null, { status: 413 });
  try {
    const result = await fetch("http://127.0.0.1:8796/scan", { method: "POST", body: req.body, signal: AbortSignal.timeout(9000) });
    return new Response(result.body, {
      status: result.status,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
