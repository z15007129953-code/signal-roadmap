import { handleDemoRequest } from "@/features/auth/demo-runtime";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return handleDemoRequest("cleanup", request);
}
