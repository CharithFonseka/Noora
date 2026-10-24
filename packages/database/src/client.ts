import dotenv from "dotenv";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const environmentPath = [resolve(moduleDirectory, "../../../.env"), resolve(moduleDirectory, "../../../../.env")].find(existsSync);
if (environmentPath) dotenv.config({ path: environmentPath });

const databaseUrl = new URL(process.env.DATABASE_URL ?? "mysql://noora:noora_local_password@127.0.0.1:3306/noora_dev");
const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST ?? databaseUrl.hostname,
  port: Number(process.env.DATABASE_PORT ?? databaseUrl.port ?? 3306),
  user: process.env.DATABASE_USER ?? decodeURIComponent(databaseUrl.username),
  password: process.env.DATABASE_PASSWORD ?? decodeURIComponent(databaseUrl.password),
  database: process.env.DATABASE_NAME ?? databaseUrl.pathname.slice(1),
  connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT ?? 5),
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

export const prisma = new PrismaClient({ adapter });

