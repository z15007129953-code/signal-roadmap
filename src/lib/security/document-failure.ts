/** Dependency-free recovery: still works when Redis or page rendering is down. */
export function documentFailure(response: Response, id: string) {
  const limited = response.status === 429;
  const supplied = Number(response.headers.get("Retry-After"));
  const seconds =
    Number.isInteger(supplied) && supplied > 0 ? Math.min(supplied, 86400) : 60;
  const reference = /^[A-Za-z0-9_-]{8,64}$/.test(id) ? id : "unavailable";
  const title = limited
    ? "A short pause before continuing."
    : "This page is temporarily unavailable.";
  const message = limited
    ? `Please wait ${seconds} seconds, then reload this page. Your existing work has not been removed.`
    : "Please try loading this page again in a moment. You can return home while the service recovers.";
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  // Next treats non-Flight responses to RSC fetches as a hard navigation;
  // the destination then renders this same standalone recovery document.
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Signal Roadmap</title><style>body{margin:0;background:#faf8f3;color:#302c26;font-family:Verdana,sans-serif;line-height:1.6}main{max-width:42rem;margin:8vh auto;padding:1.5rem}h1{font-family:Georgia,serif;font-size:2rem;line-height:1.2}a{color:inherit;display:inline-flex;align-items:center;min-height:44px}a:focus-visible{outline:2px solid #b24e35;outline-offset:4px}p{overflow-wrap:anywhere}</style></head><body><main><p>Signal Roadmap /</p><h1>${title}</h1><p>${message}</p><p>Reference: ${reference}</p><a href="/">Back to home</a></main></body></html>`,
    { status: response.status, headers },
  );
}
