import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const tokensPath = resolve(process.cwd(), "src/styles/tokens.css");

describe("design token contract", () => {
  it("provides the required semantic foundation", () => {
    expect(existsSync(tokensPath), `${tokensPath} should exist`).toBe(true);

    if (!existsSync(tokensPath)) return;

    const tokens = readFileSync(tokensPath, "utf8");
    const requiredVariables = [
      "--color-canvas",
      "--color-surface",
      "--color-text",
      "--color-text-muted",
      "--color-border",
      "--color-accent",
      "--color-focus",
      "--color-danger",
      "--status-under-review",
      "--status-planned",
      "--status-in-progress",
      "--status-completed",
      "--status-closed",
      "--font-body",
      "--motion-fast",
    ];

    for (const variable of requiredVariables) {
      expect(tokens, `${variable} should be defined`).toMatch(
        new RegExp(`${variable}\\s*:`),
      );
    }

    expect(tokens).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/);
    expect(tokens).toMatch(/oklch\(/);
  });
});
