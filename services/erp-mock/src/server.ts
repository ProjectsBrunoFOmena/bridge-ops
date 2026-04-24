import Fastify from "fastify";
import { randomUUID } from "node:crypto";

const app = Fastify({ logger: true });
const forcedSkus = (process.env.ERP_MOCK_FORCE_ERROR_SKUS ?? "").split(",").filter(Boolean);
const blockedDocuments = (process.env.ERP_MOCK_BLOCKED_DOCUMENTS ?? "").split(",").filter(Boolean);
const unavailableSeconds = Number(process.env.ERP_MOCK_UNAVAILABLE_SECONDS ?? 0);
const unavailableUntil = Date.now() + unavailableSeconds * 1000;

app.get("/health", async () => ({ status: "ok" }));

app.post("/integrations/orders", async (req, reply) => {
  if (Date.now() < unavailableUntil) {
    return reply.status(503).send({
      code: "TIMEOUT_SIMULADO",
      message: "ERP temporariamente indisponivel"
    });
  }

  const body = req.body as {
    document?: string;
    items?: Array<{ sku: string }>;
  };
  if (!body || !Array.isArray(body.items)) {
    return reply.status(400).send({ code: "INVALID_PAYLOAD", message: "Payload invalido" });
  }

  if (body.document && blockedDocuments.includes(body.document)) {
    return reply.status(422).send({
      code: "CLIENTE_BLOQUEADO",
      message: "Cliente bloqueado para integracao"
    });
  }

  const unknownSku = body.items.find((item) => forcedSkus.includes(item.sku));
  if (unknownSku) {
    return reply.status(422).send({
      code: "SKU_DESCONHECIDO",
      message: `SKU ${unknownSku.sku} nao encontrado no ERP`
    });
  }

  return reply.status(200).send({
    integrationId: randomUUID(),
    message: "Pedido integrado com sucesso"
  });
});

const port = Number(process.env.ERP_MOCK_PORT ?? 3001);
await app.listen({ host: "0.0.0.0", port });
