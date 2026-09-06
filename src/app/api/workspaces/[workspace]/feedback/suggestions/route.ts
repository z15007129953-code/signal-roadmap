import { handleFeedbackRequest } from "@/lib/feedback-runtime";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ workspace: string }> },
) {
  return handleFeedbackRequest(
    "suggest",
    request,
    (await context.params).workspace,
  );
}
