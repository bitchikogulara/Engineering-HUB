import { auth } from "@/lib/auth";

// Accessing auth.handler lazily per request keeps env reads out of build time
// (toNextJsHandler would capture the handler at module evaluation).
export async function GET(request: Request) {
  return auth.handler(request);
}

export async function POST(request: Request) {
  return auth.handler(request);
}
