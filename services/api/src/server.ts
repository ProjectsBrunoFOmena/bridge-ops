import { createApp } from "./app.js";

const app = await createApp();
const port = Number(process.env.API_PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
