import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

const tokens = readFileSync(
  resolve(process.cwd(), "src/styles/tokens.css"),
  "utf8",
);
const globals = readFileSync(
  resolve(process.cwd(), "src/app/globals.css"),
  "utf8",
);

function declarations(css: string) {
  return Object.fromEntries(
    [...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  );
}

const lightBlock = tokens.match(/^:root\s*\{([^}]+)\}/)?.[1] ?? "";
const darkBlock =
  tokens.match(
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]+)\}/,
  )?.[1] ?? "";
const light = declarations(lightBlock);
const darkOverrides = declarations(darkBlock);
const themes = { light, dark: { ...light, ...darkOverrides } };
const surfaces = [
  "--color-canvas",
  "--color-surface",
  "--color-surface-raised",
  "--color-surface-muted",
];
const statuses = [
  "under-review",
  "planned",
  "in-progress",
  "completed",
  "closed",
];

// CSS Color 4 OKLab -> linear sRGB; clip to the sRGB display gamut before
// applying WCAG relative luminance. All audited token colors are opaque.
function luminance(color: string) {
  const match = color.match(/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/);
  if (!match) throw new Error(`Expected opaque OKLCH color, received ${color}`);
  const [lightness, chroma, hue] = match.slice(1).map(Number);
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => Math.max(0, Math.min(1, channel)));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function contrast(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("design token contract", () => {
  it("uses the WCAG contrast scale", () => {
    expect(contrast("oklch(0 0 0)", "oklch(1 0 0)")).toBeCloseTo(21);
    expect(contrast("oklch(0.5 0 0)", "oklch(0.5 0 0)")).toBe(1);
  });

  it("explicitly supplies every semantic color in both themes", () => {
    const required = [
      ...surfaces,
      "--color-text",
      "--color-text-muted",
      "--color-border",
      "--color-border-control",
      "--color-accent",
      "--color-accent-contrast",
      "--color-focus",
      "--color-danger",
      ...statuses.map((status) => `--status-${status}`),
    ];
    for (const palette of [light, darkOverrides]) {
      for (const token of required) {
        expect(
          palette[token],
          `${token} must be defined in each theme`,
        ).toMatch(/^oklch\(/);
      }
    }
  });

  for (const [theme, palette] of Object.entries(themes)) {
    it(`${theme}: supports normal-size action labels`, () => {
      expect(
        contrast(palette["--color-accent-contrast"], palette["--color-accent"]),
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`${theme}: keeps text, status labels, and controls legible on every surface`, () => {
      const readable = [
        "--color-text",
        "--color-text-muted",
        "--color-accent",
        "--color-danger",
        ...statuses.map((status) => `--status-${status}`),
      ];
      for (const surface of surfaces) {
        for (const foreground of readable) {
          expect(
            contrast(palette[foreground], palette[surface]),
            `${theme} ${foreground} on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        for (const boundary of ["--color-border-control", "--color-focus"]) {
          expect(
            contrast(palette[boundary], palette[surface]),
            `${theme} ${boundary} against ${surface}`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    });
  }

  it("generates usable Tailwind colors that resolve to source tokens", async () => {
    const theme = globals.match(/@theme inline\s*\{[^}]+\}/)?.[0];
    expect(theme).toBeDefined();
    const compiler = await compile(`${theme}\n@tailwind utilities;`);
    const utilities = [
      ["bg-background", "--color-canvas"],
      ["text-foreground", "--color-text"],
      ["text-muted", "--color-text-muted"],
      ["bg-panel", "--color-surface"],
      ["bg-panel-raised", "--color-surface-raised"],
      ["bg-panel-muted", "--color-surface-muted"],
      ["border-rule", "--color-border"],
      ["border-control", "--color-border-control"],
      ["bg-action", "--color-accent"],
      ["text-action-foreground", "--color-accent-contrast"],
      ["outline-ring", "--color-focus"],
      ["text-critical", "--color-danger"],
      ...statuses.map((status) => [
        `text-status-${status}`,
        `--status-${status}`,
      ]),
    ];
    const css = compiler.build(utilities.map(([utility]) => utility));
    for (const [utility, token] of utilities) {
      const rule = css.match(new RegExp(`\\.${utility}\\s*\\{([^}]+)\\}`));
      expect(rule?.[1], `${utility} must resolve to ${token}`).toContain(
        `var(${token})`,
      );
    }
  });

  it("keeps interactive defaults below explicit font and color utilities", async () => {
    const baseStart = globals.indexOf("@layer base {");
    expect(baseStart).toBeGreaterThanOrEqual(0);
    let depth = 1;
    let baseEnd = globals.indexOf("{", baseStart) + 1;
    const contentStart = baseEnd;
    while (depth > 0 && baseEnd < globals.length) {
      if (globals[baseEnd] === "{") depth++;
      if (globals[baseEnd] === "}") depth--;
      baseEnd++;
    }
    expect(depth).toBe(0);
    const base = globals.slice(contentStart, baseEnd - 1);
    const outsideBase = globals.slice(0, baseStart) + globals.slice(baseEnd);
    expect(base).toMatch(
      /a,\s*button,\s*input,\s*select,\s*textarea\s*\{\s*font:\s*inherit;/,
    );
    expect(base).toMatch(/\ba\s*\{\s*color:\s*inherit;/);
    expect(outsideBase).not.toMatch(/\bfont:\s*inherit;/);
    expect(outsideBase).not.toMatch(/\ba\s*\{[^}]*color:\s*inherit;/);

    // Include the actual stylesheet and Tailwind layer ordering: utility
    // declarations must be generated in the higher-priority utilities layer.
    const compiler = await compile(
      `@layer theme, base, components, utilities;\n${globals.replace(/^@import[^;]+;/gm, "")}\n@layer utilities { @tailwind utilities; }`,
    );
    const css = compiler.build(["text-action", "font-serif"]);
    expect(css).toContain("@layer theme, base, components, utilities;");
    expect(css).toMatch(
      /@layer utilities\s*\{[\s\S]*\.text-action\s*\{\s*color:\s*var\(--color-accent\);/,
    );
    expect(css).toMatch(
      /@layer utilities\s*\{[\s\S]*\.font-serif\s*\{\s*font-family:\s*var\(--font-display\);/,
    );
  });
});
