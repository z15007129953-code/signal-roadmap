// Project-local development only. Never replaces an existing database or env file.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const local = path.join(root, ".local");
const bin = path.join(local, "postgres/bin");
const mode = process.argv[2];
const clusters = [
  { name: "development", port: 54329, database: "signal" },
  { name: "test", port: 54330, database: "signal_test" },
];
function run(command, args, extra = {}) {
  const result = spawnSync(path.join(bin, command), args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C" },
    ...extra,
  });
  if (result.status !== 0)
    throw new Error(
      `${command} failed; inspect the project-local database log.`,
    );
}
function start(cluster) {
  const data = path.join(local, `postgres-${cluster.name}`);
  if (!existsSync(path.join(data, "PG_VERSION")))
    throw new Error("Initialize local databases first.");
  const status = spawnSync(path.join(bin, "pg_ctl"), ["-D", data, "status"], {
    stdio: "ignore",
  });
  if (status.status === 0) return;
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    path.join(local, `postgres-${cluster.name}.log`),
    "-o",
    `-h 127.0.0.1 -p ${cluster.port} -k ''`,
    "-w",
    "start",
  ]);
}
try {
  if (!existsSync(path.join(bin, "initdb")))
    throw new Error("Install PostgreSQL into .local/postgres first.");
  if (mode === "start") {
    for (const cluster of clusters) start(cluster);
  } else if (mode === "init") {
    if (
      existsSync(path.join(root, ".env.local")) ||
      clusters.some((c) => existsSync(path.join(local, `postgres-${c.name}`)))
    ) {
      throw new Error(
        "Existing configuration or database found. Nothing was overwritten.",
      );
    }
    mkdirSync(local, { recursive: true, mode: 0o700 });
    const password = randomBytes(32).toString("hex");
    const pwfile = path.join(local, "postgres-init-password");
    writeFileSync(pwfile, password, { mode: 0o600, flag: "wx" });
    try {
      for (const cluster of clusters) {
        run("initdb", [
          "-D",
          path.join(local, `postgres-${cluster.name}`),
          "-U",
          "signal_local",
          "--auth=scram-sha-256",
          "--encoding=UTF8",
          "--locale=C",
          `--pwfile=${pwfile}`,
        ]);
        start(cluster);
        run(
          "createdb",
          [
            "-h",
            "127.0.0.1",
            "-p",
            String(cluster.port),
            "-U",
            "signal_local",
            cluster.database,
          ],
          { env: { ...process.env, LC_ALL: "C", PGPASSWORD: password } },
        );
      }
      const env = [
        "NODE_ENV=development",
        "APP_URL=http://127.0.0.1:3100",
        ...clusters.map(
          (c) =>
            `${c.name === "test" ? "TEST_DATABASE_URL" : "DATABASE_URL"}=postgresql://signal_local:${password}@127.0.0.1:${c.port}/${c.database}`,
        ),
        ...["AUTH_SECRET", "DEMO_COOKIE_SECRET", "CRON_SECRET"].map(
          (key) => `${key}=${randomBytes(32).toString("hex")}`,
        ),
      ];
      writeFileSync(path.join(root, ".env.local"), env.join("\n") + "\n", {
        mode: 0o600,
        flag: "wx",
      });
    } finally {
      unlinkSync(pwfile);
    }
  } else throw new Error("Usage: node scripts/local-database.mjs init|start");
  console.info(
    "Project-local development and test databases are running on loopback only.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
