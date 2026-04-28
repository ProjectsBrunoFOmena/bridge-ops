import { afterEach, describe, expect, it, vi } from "vitest";
import { testPool } from "../setup.js";
import { createTestApp, loginOperator } from "../helpers/apiTestUtils.js";
import { processOneEvent } from "../../../worker/src/worker.js";

describe("Fluxo critico integrado", () => {
  let app: Awaited<ReturnType<typeof createTestApp>> | null = null;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("cria excecao e resolve com reprocesso bem-sucedido", async () => {
    app = await createTestApp(testPool);
    const token = await loginOperator(app);

    const customerResponse = await app.inject({
      method: "POST",
      url: "/customers",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: "Cliente Fluxo",
        document: `DOC-${Date.now()}`,
        email: `fluxo-${Date.now()}@demo.local`
      }
    });
    expect(customerResponse.statusCode).toBe(201);
    const customerId = (customerResponse.json() as { id: string }).id;

    const orderResponse = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        customerId,
        reference: `PED-CRITICO-${Date.now()}`,
        items: [{ sku: "ERR-001", quantity: 1, unitPrice: 100 }]
      }
    });
    expect(orderResponse.statusCode).toBe(201);
    const orderId = (orderResponse.json() as { id: string }).id;

    const confirmResponse = await app.inject({
      method: "POST",
      url: `/orders/${orderId}/confirm`,
      headers: { authorization: `Bearer ${token}`, "x-correlation-id": "corr-critical-1" }
    });
    expect(confirmResponse.statusCode).toBe(200);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        code: "SKU_DESCONHECIDO",
        message: "SKU nao encontrado no ERP"
      })
    } as Response);

    await processOneEvent();

    const exceptionResult = await testPool.query(
      "SELECT id, status, lock_version FROM exceptions WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1",
      [orderId]
    );
    expect(exceptionResult.rowCount).toBe(1);
    const exceptionId = exceptionResult.rows[0].id as string;
    expect(exceptionResult.rows[0].status).toBe("aberta");

    const analyzeResponse = await app.inject({
      method: "POST",
      url: `/exceptions/${exceptionId}/analyze`,
      headers: { authorization: `Bearer ${token}`, "x-correlation-id": "corr-critical-2" }
    });
    expect(analyzeResponse.statusCode).toBe(200);
    const lockVersion = (analyzeResponse.json() as { lock_version: number }).lock_version;

    const reprocessResponse = await app.inject({
      method: "POST",
      url: `/exceptions/${exceptionId}/reprocess`,
      headers: { authorization: `Bearer ${token}`, "x-correlation-id": "corr-critical-3" },
      payload: { lockVersion }
    });
    expect(reprocessResponse.statusCode).toBe(200);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        integrationId: "integration-ok",
        message: "Pedido integrado com sucesso"
      })
    } as Response);

    await processOneEvent();

    const orderStatus = await testPool.query("SELECT status FROM orders WHERE id = $1", [orderId]);
    expect(orderStatus.rows[0].status).toBe("integrado");

    const finalException = await testPool.query("SELECT status, resolved_at FROM exceptions WHERE id = $1", [
      exceptionId
    ]);
    expect(finalException.rows[0].status).toBe("resolvida");
    expect(finalException.rows[0].resolved_at).toBeTruthy();
  });
});
