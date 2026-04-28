import { afterEach, describe, expect, it } from "vitest";
import { createCustomerRecord, testPool } from "../setup.js";
import { createTestApp, loginOperator } from "../helpers/apiTestUtils.js";

describe("Regras de pedidos e lock", () => {
  let app: Awaited<ReturnType<typeof createTestApp>> | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("retorna 400 para criacao de pedido invalida", async () => {
    app = await createTestApp(testPool);
    const token = await loginOperator(app);

    const response = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        customerId: "invalido",
        reference: "",
        items: []
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty("message", "payload invalido");
  });

  it("retorna 409 ao confirmar pedido fora de estado valido", async () => {
    app = await createTestApp(testPool);
    const token = await loginOperator(app);

    const response = await app.inject({
      method: "POST",
      url: "/orders/00000000-0000-0000-0000-00000000abcd/confirm",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(409);
  });

  it("retorna 409 para reprocesso com lockVersion invalido", async () => {
    app = await createTestApp(testPool);
    const token = await loginOperator(app);
    const customerId = await createCustomerRecord();

    const orderResult = await testPool.query(
      `INSERT INTO orders (customer_id, reference, status, total_amount)
       VALUES ($1, $2, 'com_excecao', 100)
       RETURNING id`,
      [customerId, `PED-${Date.now()}`]
    );
    const orderId = orderResult.rows[0].id as string;

    await testPool.query(
      `INSERT INTO order_items (order_id, sku, quantity, unit_price)
       VALUES ($1, 'ERR-001', 1, 100)`,
      [orderId]
    );

    const attemptResult = await testPool.query(
      `INSERT INTO integration_attempts (order_id, status, payload_snapshot, correlation_id)
       VALUES ($1, 'failed', '{}'::jsonb, 'corr-test')
       RETURNING id`,
      [orderId]
    );
    const attemptId = attemptResult.rows[0].id as string;

    const exceptionResult = await testPool.query(
      `INSERT INTO exceptions (order_id, attempt_id, status, error_code, error_message, lock_version, locked_by)
       VALUES ($1, $2, 'em_analise', 'SKU_DESCONHECIDO', 'SKU invalido', 3, $3)
       RETURNING id`,
      [orderId, attemptId, "00000000-0000-0000-0000-000000000002"]
    );
    const exceptionId = exceptionResult.rows[0].id as string;

    const response = await app.inject({
      method: "POST",
      url: `/exceptions/${exceptionId}/reprocess`,
      headers: { authorization: `Bearer ${token}` },
      payload: { lockVersion: 2 }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toHaveProperty("message", "lock invalido para reprocesso");
  });
});
