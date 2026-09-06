export function feedbackPath(workspace: string) {
  return `/${encodeURIComponent(workspace)}/feedback`;
}
