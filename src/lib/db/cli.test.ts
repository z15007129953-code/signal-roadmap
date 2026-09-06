// @vitest-environment node
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("database command entry points", () => {
  it.each(["migrate", "reset-test", "test"])(
    "%s fails clearly without configuration",
    (command) => {
      const result = spawnSync(
        process.execPath,
        ["src/lib/db/cli.ts", command],
        {
          encoding: "utf8",
          env: { ...process.env, DATABASE_URL: "", TEST_DATABASE_URL: "" },
        },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        command === "migrate"
          ? "DATABASE_URL is required"
          : "TEST_DATABASE_URL is required",
      );
      expect(result.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
    },
  );

  it("rejects unsafe reset targets without exposing connection credentials", () => {
    const result = spawnSync(
      process.execPath,
      ["src/lib/db/cli.ts", "reset-test"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          TEST_DATABASE_URL:
            "postgres://user:private-password@remote.example.com/production",
        },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Database command failed");
    expect(result.stderr).not.toContain("private-password");
  });
});
