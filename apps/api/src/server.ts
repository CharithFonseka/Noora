import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const app = express();
const port = Number(process.env.PORT ?? 4000);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: webOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok", service: "noora-api" });
});

app.get("/ready", (_request, response) => {
  response.status(200).json({ status: "ready", service: "noora-api" });
});

app.use((_request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
});

app.listen(port, "0.0.0.0", () => {
  console.log(\`NOORA API listening on port \${port}\`);
});

