import { handleDemoRequest } from "@/features/auth/demo-runtime";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleDemoRequest("switchPersona", request);
}
