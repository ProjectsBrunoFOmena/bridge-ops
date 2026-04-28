import { Pool } from "pg";
import { createApp } from "../../src/app.js";

export async function createTestApp(pool: Pool) {
  const app = await createApp(pool);
  await app.ready();
  return app;
}

export async function loginOperator(app: Awaited<ReturnType<typeof createTestApp>>) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "operator@demo.local",
      password: "operator123"
    }
  });
  const body = response.json() as { token: string };
  return body.token;
}
