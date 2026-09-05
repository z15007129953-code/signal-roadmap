import { describe, expect, it } from "vitest";

import { productName } from "@/lib/product";

describe("product metadata", () => {
  it("uses the approved public name", () => {
    expect(productName).toBe("Signal Roadmap");
  });
});
