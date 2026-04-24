import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";

type Role = "viewer" | "operator";

const app = Fastify({ logger: true });
const pool = new Pool({
  host: "db",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB
});

const orderCreateSchema = z.object({
  customerId: z.string().uuid(),
  reference: z.string().min(1),
  items: z.array(
    z.object({
      sku: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative()
    })
  ).min(1)
});

app.addHook("onRequest", async (req) => {
  req.headers["x-correlation-id"] = req.headers["x-correlation-id"] ?? randomUUID();
});

app.setErrorHandler((error, req, reply) => {
  reply.status(error.statusCode ?? 500).type("application/problem+json").send({
    type: "about:blank",
    title: error.name,
    status: error.statusCode ?? 500,
    detail: error.message,
    correlation_id: req.headers["x-correlation-id"]
  });
});

await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET ?? "unsafe-dev-secret" });
await app.register(swagger, {
  openapi: {
    info: {
      title: "Portal de Excecoes API",
      version: "0.1.0"
    }
  }
});
await app.register(swaggerUi, { routePrefix: "/docs" });

app.get("/health", async () => {
  const check = await pool.query("SELECT NOW()");
  return { status: "ok", dbTime: check.rows[0].now };
});

app.post("/auth/login", async (req, reply) => {
  const body = req.body as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return reply.status(400).send({ message: "email e password sao obrigatorios" });
  }

  const result = await pool.query(
    "SELECT id, email, role, password_hash FROM users WHERE email = $1",
    [body.email]
  );
  const user = result.rows[0];
  if (!user || user.password_hash !== body.password) {
    return reply.status(401).send({ message: "credenciais invalidas" });
  }

  const token = await reply.jwtSign({ sub: user.id, role: user.role as Role });
  return { token, user: { id: user.id, email: user.email, role: user.role } };
});

app.post("/customers", async (req, reply) => {
  await req.jwtVerify();
  const role = (req.user as { role: Role }).role;
  if (role !== "operator") {
    return reply.status(403).send({ message: "apenas operator pode criar cliente" });
  }

  const body = req.body as { name: string; document: string; email: string };
  const created = await pool.query(
    `INSERT INTO customers (name, document, email)
     VALUES ($1, $2, $3)
     RETURNING id, name, document, email, created_at`,
    [body.name, body.document, body.email]
  );
  return reply.status(201).send(created.rows[0]);
});

app.post("/orders", async (req, reply) => {
  await req.jwtVerify();
  const role = (req.user as { role: Role }).role;
  if (role !== "operator") {
    return reply.status(403).send({ message: "apenas operator pode criar pedido" });
  }

  const parsed = orderCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ message: "payload invalido", issues: parsed.error.issues });
  }
  const { customerId, reference, items } = parsed.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = await client.query(
      `INSERT INTO orders (customer_id, reference, status, total_amount)
       VALUES ($1, $2, 'rascunho', $3)
       RETURNING id, status, reference`,
      [customerId, reference, items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, sku, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [order.rows[0].id, item.sku, item.quantity, item.unitPrice]
      );
    }

    await client.query("COMMIT");
    return reply.status(201).send(order.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.post("/orders/:id/confirm", async (req, reply) => {
  await req.jwtVerify();
  const role = (req.user as { role: Role }).role;
  if (role !== "operator") {
    return reply.status(403).send({ message: "apenas operator pode confirmar pedido" });
  }

  const orderId = (req.params as { id: string }).id;
  const correlationId = String(req.headers["x-correlation-id"]);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE orders
       SET status = 'em_integracao', updated_at = NOW()
       WHERE id = $1 AND status IN ('rascunho', 'com_excecao')
       RETURNING id, reference, status`,
      [orderId]
    );
    if (updated.rowCount === 0) {
      await client.query("ROLLBACK");
      return reply.status(409).send({ message: "pedido nao pode ser confirmado no estado atual" });
    }

    await client.query(
      `INSERT INTO outbox_events (event_type, aggregate_id, payload, correlation_id)
       VALUES ('order.confirmed', $1, $2::jsonb, $3)`,
      [orderId, JSON.stringify({ orderId }), correlationId]
    );
    await client.query("COMMIT");
    return { message: "pedido enviado para integracao", order: updated.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.get("/exceptions", async (req) => {
  await req.jwtVerify();
  const q = req.query as { status?: string; errorCode?: string };
  const values: string[] = [];
  const filters: string[] = [];

  if (q.status) {
    values.push(q.status);
    filters.push(`e.status = $${values.length}`);
  }
  if (q.errorCode) {
    values.push(q.errorCode);
    filters.push(`e.error_code = $${values.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = await pool.query(
    `SELECT e.id, e.status, e.error_code, e.error_message, e.created_at, o.reference
     FROM exceptions e
     JOIN orders o ON o.id = e.order_id
     ${where}
     ORDER BY e.created_at DESC`,
    values
  );
  return rows.rows;
});

app.post("/exceptions/:id/analyze", async (req, reply) => {
  await req.jwtVerify();
  const user = req.user as { sub: string; role: Role };
  if (user.role !== "operator") {
    return reply.status(403).send({ message: "apenas operator pode assumir analise" });
  }

  const exceptionId = (req.params as { id: string }).id;
  const correlationId = String(req.headers["x-correlation-id"]);
  const updated = await pool.query(
    `UPDATE exceptions
     SET status = 'em_analise',
         locked_by = $2,
         locked_at = NOW(),
         lock_version = lock_version + 1,
         updated_at = NOW()
     WHERE id = $1 AND status = 'aberta' AND locked_by IS NULL
     RETURNING id, status, lock_version`,
    [exceptionId, user.sub]
  );
  if (updated.rowCount === 0) {
    return reply.status(409).send({ message: "excecao ja esta em analise por outro operador" });
  }

  await pool.query(
    `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_role, correlation_id, after_data)
     VALUES ('exception', $1, 'mark_in_analysis', $2, $3, $4, $5::jsonb)`,
    [exceptionId, user.sub, user.role, correlationId, JSON.stringify(updated.rows[0])]
  );
  return updated.rows[0];
});

app.post("/exceptions/:id/reprocess", async (req, reply) => {
  await req.jwtVerify();
  const user = req.user as { sub: string; role: Role };
  if (user.role !== "operator") {
    return reply.status(403).send({ message: "apenas operator pode reprocessar" });
  }

  const exceptionId = (req.params as { id: string }).id;
  const lockVersion = Number((req.body as { lockVersion?: number }).lockVersion ?? -1);
  const correlationId = String(req.headers["x-correlation-id"]);

  const exceptionResult = await pool.query(
    `SELECT id, order_id, status, lock_version, locked_by
     FROM exceptions WHERE id = $1`,
    [exceptionId]
  );
  const ex = exceptionResult.rows[0];
  if (!ex || ex.status === "descartada") {
    return reply.status(409).send({ message: "excecao nao permite reprocesso" });
  }
  if (ex.locked_by !== user.sub || ex.lock_version !== lockVersion) {
    return reply.status(409).send({ message: "lock invalido para reprocesso" });
  }

  await pool.query(
    `INSERT INTO outbox_events (event_type, aggregate_id, payload, correlation_id)
     VALUES ('order.reprocess', $1, $2::jsonb, $3)`,
    [ex.order_id, JSON.stringify({ orderId: ex.order_id }), correlationId]
  );
  await pool.query("UPDATE orders SET status = 'em_integracao', updated_at = NOW() WHERE id = $1", [ex.order_id]);
  await pool.query(
    `INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, actor_role, correlation_id)
     VALUES ('exception', $1, 'reprocess', $2, $3, $4)`,
    [exceptionId, user.sub, user.role, correlationId]
  );
  return { message: "reprocessamento enfileirado" };
});

app.post("/exceptions/:id/discard", async (req, reply) => {
  await req.jwtVerify();
  const user = req.user as { sub: string; role: Role };
  if (user.role !== "operator") {
    return reply.status(403).send({ message: "apenas operator pode descartar" });
  }

  const exceptionId = (req.params as { id: string }).id;
  const body = req.body as { reason?: string; lockVersion?: number };
  if (!body.reason) {
    return reply.status(400).send({ message: "motivo de descarte e obrigatorio" });
  }

  const updated = await pool.query(
    `UPDATE exceptions
     SET status = 'descartada', discard_reason = $2, updated_at = NOW(), lock_version = lock_version + 1
     WHERE id = $1 AND lock_version = $3
     RETURNING id, status`,
    [exceptionId, body.reason, body.lockVersion ?? -1]
  );
  if (updated.rowCount === 0) {
    return reply.status(409).send({ message: "conflito de versao na excecao" });
  }
  return updated.rows[0];
});

const port = Number(process.env.API_PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
