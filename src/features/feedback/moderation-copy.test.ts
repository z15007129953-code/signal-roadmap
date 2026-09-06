// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("keeps system-generated moderation notifications in the approved English language", () => {
  const source = readFileSync(
    new URL("./moderation-repository.ts", import.meta.url),
    "utf8",
  );
  expect(source).not.toMatch(/[\u4e00-\u9fff]/);
});
