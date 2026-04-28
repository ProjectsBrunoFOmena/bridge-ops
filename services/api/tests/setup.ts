import { afterAll, beforeAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "..", "..", "infra", "db", "migrations", "001_init.sql");
const seedPath = join(process.cwd(), "..", "..", "infra", "db", "seeds", "001_demo_users.sql");

const migrationSql = readFileSync(migrationPath, "utf8");
const seedSql = readFileSync(seedPath, "utf8");

export const testPool = new Pool({
  host: process.env.POSTGRES_HOST ?? "127.0.0.1",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER ?? "postgres",
  password: process.env.POSTGRES_PASSWORD ?? "postgres",
  database: process.env.POSTGRES_DB ?? "portal_excecoes"
});

const tables = [
  "audit_logs",
  "exceptions",
  "integration_attempts",
  "outbox_events",
  "order_items",
  "orders",
  "customers",
  "users"
];

export async function cleanDatabase() {
  await testPool.query(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
}

export async function seedUsers() {
  await testPool.query(seedSql);
}

export async function createCustomerRecord() {
  const result = await testPool.query(
    `INSERT INTO customers (name, document, email)
     VALUES ($1, $2, $3)
     RETURNING id`,
    ["Cliente Teste", `DOC-${Date.now()}`, `cliente-${randomUUID()}@test.local`]
  );
  return result.rows[0].id as string;
}

beforeAll(async () => {
  await testPool.query(migrationSql);
});

beforeEach(async () => {
  await cleanDatabase();
  await seedUsers();
});

afterAll(async () => {
  await testPool.end();
});
