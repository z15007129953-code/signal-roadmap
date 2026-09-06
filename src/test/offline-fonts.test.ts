// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("offline font foundation", () => {
  it("does not require a Google Fonts download to build", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).not.toContain("next/font/google");
  });

  it("keeps font declarations valid when optional font variables are absent", () => {
    const tokens = readFileSync("src/styles/tokens.css", "utf8");
    expect(tokens).toContain('var(--font-geist-sans, "Segoe UI")');
    expect(tokens).toContain('var(--font-geist-mono, "SFMono-Regular")');
  });
});
