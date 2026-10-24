import dotenv from "dotenv";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST ?? new URL(process.env.DATABASE_URL ?? "mysql://noora:noora_local_password@127.0.0.1:3306/noora_dev").hostname,
  port: Number(process.env.DATABASE_PORT ?? new URL(process.env.DATABASE_URL ?? "mysql://noora:noora_local_password@127.0.0.1:3306/noora_dev").port ?? 3306),
  user: process.env.DATABASE_USER ?? decodeURIComponent(new URL(process.env.DATABASE_URL ?? "mysql://noora:noora_local_password@127.0.0.1:3306/noora_dev").username),
  password: process.env.DATABASE_PASSWORD ?? decodeURIComponent(new URL(process.env.DATABASE_URL ?? "mysql://noora:noora_local_password@127.0.0.1:3306/noora_dev").password),
  database: process.env.DATABASE_NAME ?? new URL(process.env.DATABASE_URL ?? "mysql://noora:noora_local_password@127.0.0.1:3306/noora_dev").pathname.slice(1),
  connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT ?? 5),
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

export const prisma = new PrismaClient({ adapter });

