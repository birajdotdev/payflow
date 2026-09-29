// Disposable PostgreSQL + real Spring Boot + production Next.js. Never reads .env.
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const container = `payflow-e2e-${process.pid}`;
const dbPassword = randomBytes(24).toString("hex");
const children = [];
let cleaning = false;
let failApi = false;
let proxy;
function start(command, args, env, cwd = root) {
  const child = spawn(command, args, {
    cwd,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !/^(SPRING_|DB_|JWT_|PAYFLOW_)/.test(key)
        )
      ),
      ...env,
    },
    stdio: "inherit",
  });
  children.push(child);
  child.on("exit", () => {
    if (!cleaning) cleanup(1);
  });
  return child;
}
function cleanup(code = 0) {
  if (cleaning) return;
  cleaning = true;
  for (const child of children) child.kill("SIGTERM");
  proxy?.close();
  try {
    execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  } catch {}
  process.exit(code);
}
process.on("SIGTERM", () => cleanup());
process.on("SIGINT", () => cleanup());
async function waitFor(url) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Timed out starting ${url}`);
}
try {
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "-d",
      "--name",
      container,
      "-e",
      "POSTGRES_DB=payflow_e2e",
      "-e",
      "POSTGRES_USER=payflow_e2e",
      "-e",
      `POSTGRES_PASSWORD=${dbPassword}`,
      "-p",
      "127.0.0.1::5432",
      "postgres:18.6",
    ],
    { stdio: "pipe" }
  );
  const port = execFileSync("docker", ["port", container, "5432/tcp"], {
    encoding: "utf8",
  })
    .trim()
    .split(":")
    .pop();
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      execFileSync(
        "docker",
        ["exec", container, "pg_isready", "-U", "payflow_e2e"],
        { stdio: "ignore" }
      );
      break;
    } catch {
      if (attempt === 59) throw new Error("Test database did not start");
      await delay(500);
    }
  }
  start("java", ["-jar", "backend/target/backend-0.0.1-SNAPSHOT.jar"], {
    SERVER_PORT: "18080",
    SERVER_ADDRESS: "127.0.0.1",
    DB_URL: `jdbc:postgresql://127.0.0.1:${port}/payflow_e2e`,
    DB_USERNAME: "payflow_e2e",
    DB_PASSWORD: dbPassword,
    JWT_SECRET: process.env.E2E_JWT_SECRET,
    JWT_ACCESS_TOKEN_TTL: "15m",
    JWT_ISSUER: "payflow",
    JWT_AUDIENCE: "payflow-api",
  });
  await waitFor("http://127.0.0.1:18080/v3/api-docs");
  // A loopback-only fault switch exercises outage handling without changing app code.
  proxy = createServer(async (req, res) => {
    if (req.url === "/__test/failure" && req.method === "POST") {
      failApi = req.headers["x-test-failure"] === "on";
      res.writeHead(204).end();
      return;
    }
    if (failApi) {
      res
        .writeHead(503, { "content-type": "application/json" })
        .end('{"code":"SERVICE_UNAVAILABLE"}');
      return;
    }
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const upstream = await fetch(`http://127.0.0.1:18080${req.url}`, {
        method: req.method,
        headers: {
          "content-type": "application/json",
          ...(req.headers.authorization
            ? { authorization: req.headers.authorization }
            : {}),
          ...(req.headers["idempotency-key"]
            ? { "idempotency-key": req.headers["idempotency-key"] }
            : {}),
        },
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      });
      res
        .writeHead(upstream.status, { "content-type": "application/json" })
        .end(await upstream.text());
    } catch {
      res.writeHead(503).end();
    }
  });
  await new Promise((resolve) => proxy.listen(18081, "127.0.0.1", resolve));
  start(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--port",
      "13000",
      "--hostname",
      "localhost",
    ],
    {
      NODE_ENV: "production",
      PAYFLOW_API_URL: "http://127.0.0.1:18081",
      APP_ORIGIN: "http://localhost:13000",
    },
    path.join(root, "frontend")
  );
} catch (error) {
  console.error(error.message);
  cleanup(1);
}
