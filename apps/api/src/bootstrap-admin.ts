import dotenv from "dotenv";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@noora/database/client";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
const scrypt = promisify(scryptCallback);
async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim();
  const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim();
  if (!email || !password || !firstName || !lastName || password.length < 14) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (14+ characters), BOOTSTRAP_ADMIN_FIRST_NAME and BOOTSTRAP_ADMIN_LAST_NAME.");
  if (await prisma.user.count({ where: { role: "ADMIN" } })) throw new Error("An administrator already exists; bootstrap is one-time only.");
  const salt = randomBytes(16).toString("hex");
  const digest = await scrypt(password, salt, 64) as Buffer;
  await prisma.user.create({ data: { email, passwordHash: `${salt}:${digest.toString("hex")}`, firstName, lastName, role: "ADMIN", cart: { create: {} } } });
  console.log(`Initial administrator created for ${email}. Remove the bootstrap credentials from the environment now.`);
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
