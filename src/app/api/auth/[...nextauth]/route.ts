import { handlers } from "@/features/auth/auth";
import type { NextRequest } from "next/server";
import { withDiagnostics } from "@/lib/security/diagnostics";

export const runtime = "nodejs";
export const GET = (request: NextRequest) =>
  withDiagnostics(request, () => handlers.GET(request));
export const POST = (request: NextRequest) =>
  withDiagnostics(request, () => handlers.POST(request));
