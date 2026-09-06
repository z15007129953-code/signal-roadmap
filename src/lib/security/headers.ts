export function securityHeaders(options: {
  nonce: string;
  production: boolean;
  r2Account?: string;
}) {
  const upload =
    options.r2Account && /^[a-f0-9]{32}$/.test(options.r2Account)
      ? ` https://${options.r2Account}.r2.cloudflarestorage.com`
      : "";
  const headers: Record<string, string> = {
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic'${options.production ? "" : " 'unsafe-eval'"}`,
      // Branding uses validated color style attributes; executable inline scripts remain blocked.
      "style-src 'self' 'unsafe-inline'",
      `connect-src 'self'${upload}${options.production ? "" : " ws://127.0.0.1:3100 ws://localhost:3100"}`,
      "img-src 'self' blob: data:",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(options.production ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=()",
  };
  if (options.production)
    headers["Strict-Transport-Security"] = "max-age=31536000";
  return headers;
}
