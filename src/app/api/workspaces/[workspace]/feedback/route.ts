import { handleFeedbackRequest } from "@/lib/feedback-runtime";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ workspace: string }> },
) {
  return handleFeedbackRequest(
    "create",
    request,
    (await context.params).workspace,
  );
}
