import { expect, it } from "vitest";
import type { Database } from "@/lib/db";
import { createEngagementRepository } from "./engagement-repository";
it("rejects a null edit payload rather than interpreting it as a delete", async () => {
  const repository = createEngagementRepository({
    transaction: () => {
      throw new Error("Invalid input reached persistence");
    },
  } as unknown as Database);
  const id = "10000000-0000-4000-8000-000000000001";
  expect(
    await repository.editComment(null, id, id, id, null as never),
  ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
});
