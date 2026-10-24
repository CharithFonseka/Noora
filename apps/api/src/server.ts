import cors from "cors";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { prisma } from "@noora/database/client";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(",").map((origin) => origin.trim());
const cookieName = "noora_session";
const sessionDays = Number(process.env.SESSION_TTL_DAYS ?? 14);
const scrypt = promisify(scryptCallback);
type SessionUser = { id: string; email: string; firstName: string; lastName: string; role: "CUSTOMER" | "STAFF" | "ADMIN" };
declare global { namespace Express { interface Request { user?: SessionUser } } }

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));
const asyncRoute = (handler: (request: Request, response: Response) => Promise<unknown>) => (request: Request, response: Response, next: NextFunction) => { void handler(request, response).catch(next); };
const fail = (status: number, code: string, message: string): never => { throw Object.assign(new Error(message), { status, code }); };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const passwordHash = async (password: string) => { const salt = randomBytes(16).toString("hex"); const derived = await scrypt(password, salt, 64) as Buffer; return `${salt}:${derived.toString("hex")}`; };
const passwordMatches = async (password: string, saved: string) => {
  const [salt, hex] = saved.split(":"); if (!salt || !hex) return false;
  const actual = await scrypt(password, salt, 64) as Buffer; const expected = Buffer.from(hex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
const readCookie = (request: Request, name: string) => request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
const secureCookie = process.env.NODE_ENV === "production";
const setSessionCookie = (response: Response, token: string, expires: Date) => response.cookie(cookieName, token, { httpOnly: true, secure: secureCookie, sameSite: "lax", path: "/", expires });
app.use("/api", (request, _response, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && request.headers.origin && !allowedOrigins.includes(request.headers.origin)) return next(Object.assign(new Error("Request origin is not allowed."), { status: 403, code: "ORIGIN_FORBIDDEN" }));
  next();
});
app.use("/api", (request, _response, next) => { void (async () => {
  const token = readCookie(request, cookieName); if (!token) return;
  const session = await prisma.session.findUnique({ where: { tokenHash: hash(decodeURIComponent(token)) }, include: { user: true } });
  if (session && session.expiresAt > new Date() && session.user.active) request.user = { id: session.user.id, email: session.user.email, firstName: session.user.firstName, lastName: session.user.lastName, role: session.user.role };
})().then(() => next()).catch(next); });
const requireUser = (request: Request) => { if (!request.user) fail(401, "AUTH_REQUIRED", "Sign in to continue."); return request.user; };
const requireStaff = (request: Request) => { const user = requireUser(request); if (!["STAFF", "ADMIN"].includes(user.role)) fail(403, "FORBIDDEN", "You do not have permission to perform this action."); return user; };
const addressSchema = z.object({ recipient: z.string().trim().min(1).max(160), phone: z.string().trim().min(5).max(32), line1: z.string().trim().min(1).max(191), line2: z.string().trim().max(191).optional(), city: z.string().trim().min(1).max(100), district: z.string().trim().min(1).max(100), postalCode: z.string().trim().max(20).optional() });

app.get("/health", (_request, response) => response.json({ status: "ok", service: "noora-api" }));
app.get("/ready", asyncRoute(async (_request, response) => { await prisma.$queryRaw`SELECT 1`; response.json({ status: "ready", service: "noora-api" }); }));

app.post("/api/auth/register", asyncRoute(async (request, response) => {
  const input = z.object({ email: z.email().max(191), password: z.string().min(10).max(128), firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), phone: z.string().trim().max(32).optional() }).parse(request.body);
  const email = input.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) fail(409, "EMAIL_IN_USE", "An account already exists for this email.");
  const user = await prisma.user.create({ data: { ...input, email, passwordHash: await passwordHash(input.password), cart: { create: {} } }, select: { id: true, email: true, firstName: true, lastName: true, role: true } });
  const token = randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + sessionDays * 86_400_000);
  await prisma.session.create({ data: { tokenHash: hash(token), userId: user.id, expiresAt } }); setSessionCookie(response, token, expiresAt);
  response.status(201).json({ user });
}));
app.post("/api/auth/login", asyncRoute(async (request, response) => {
  const input = z.object({ email: z.email(), password: z.string().min(1).max(128) }).parse(request.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  if (!user || !user.active || !(await passwordMatches(input.password, user.passwordHash))) fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  const token = randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + sessionDays * 86_400_000);
  await prisma.session.create({ data: { tokenHash: hash(token), userId: user.id, expiresAt } }); setSessionCookie(response, token, expiresAt);
  response.json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } });
}));
app.get("/api/auth/me", (request, response) => response.json({ user: request.user ?? null }));
app.post("/api/auth/logout", asyncRoute(async (request, response) => {
  const token = readCookie(request, cookieName); if (token) await prisma.session.deleteMany({ where: { tokenHash: hash(decodeURIComponent(token)) } });
  response.clearCookie(cookieName, { httpOnly: true, secure: secureCookie, sameSite: "lax", path: "/" }); response.status(204).end();
}));

const productInclude = { category: { select: { id: true, name: true, slug: true } }, images: { orderBy: { position: "asc" as const } }, variants: { where: { active: true }, orderBy: [{ size: "asc" as const }, { color: "asc" as const }] } };
app.get("/api/categories", asyncRoute(async (_request, response) => response.json(await prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }))));
app.get("/api/products", asyncRoute(async (request, response) => {
  const query = z.object({ category: z.string().optional(), search: z.string().trim().max(100).optional(), featured: z.enum(["true", "false"]).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(48).default(24) }).parse(request.query);
  const where = { status: "ACTIVE" as const, ...(query.category ? { category: { slug: query.category } } : {}), ...(query.featured === "true" ? { featured: true } : {}), ...(query.search ? { OR: [{ name: { contains: query.search } }, { description: { contains: query.search } }] } : {}) };
  const [products, total] = await prisma.$transaction([prisma.product.findMany({ where, include: productInclude, orderBy: [{ featured: "desc" }, { createdAt: "desc" }], skip: (query.page - 1) * query.limit, take: query.limit }), prisma.product.count({ where })]);
  response.json({ products, page: query.page, limit: query.limit, total });
}));
app.get("/api/products/:slug", asyncRoute(async (request, response) => {
  const product = await prisma.product.findFirst({ where: { slug: request.params.slug, status: "ACTIVE" }, include: productInclude });
  if (!product) fail(404, "PRODUCT_NOT_FOUND", "Product was not found."); response.json({ product });
}));

app.get("/api/cart", asyncRoute(async (request, response) => {
  const user = requireUser(request);
  const cart = await prisma.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {}, include: { items: { include: { variant: { include: { product: { include: { images: { orderBy: { position: "asc" } }, category: true } } } } } } });
  response.json({ cart });
}));
app.post("/api/cart/items", asyncRoute(async (request, response) => {
  const user = requireUser(request); const input = z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(20) }).parse(request.body);
  const variant = await prisma.productVariant.findFirst({ where: { id: input.variantId, active: true, product: { status: "ACTIVE" } }, select: { id: true, stock: true } });
  if (!variant) fail(404, "VARIANT_NOT_FOUND", "This item is no longer available.");
  const cart = await prisma.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  const key = { cartId_variantId: { cartId: cart.id, variantId: variant.id } };
  const old = await prisma.cartItem.findUnique({ where: key });
  if ((old?.quantity ?? 0) + input.quantity > variant.stock) fail(409, "INSUFFICIENT_STOCK", "There is not enough stock for that quantity.");
  await prisma.cartItem.upsert({ where: key, create: { cartId: cart.id, variantId: variant.id, quantity: input.quantity }, update: { quantity: { increment: input.quantity } } });
  response.status(201).json({ added: true });
}));
app.patch("/api/cart/items/:id", asyncRoute(async (request, response) => {
  const user = requireUser(request); const { quantity } = z.object({ quantity: z.number().int().min(1).max(20) }).parse(request.body);
  const item = await prisma.cartItem.findFirst({ where: { id: request.params.id, cart: { userId: user.id } }, include: { variant: true } });
  if (!item) fail(404, "CART_ITEM_NOT_FOUND", "Cart item was not found.");
  if (item.variant.stock < quantity) fail(409, "INSUFFICIENT_STOCK", "There is not enough stock for that quantity.");
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } }); response.status(204).end();
}));
app.delete("/api/cart/items/:id", asyncRoute(async (request, response) => {
  const user = requireUser(request); await prisma.cartItem.deleteMany({ where: { id: request.params.id, cart: { userId: user.id } } }); response.status(204).end();
}));

app.post("/api/orders", asyncRoute(async (request, response) => {
  const user = requireUser(request);
  const input = z.object({ address: addressSchema, paymentMethod: z.literal("CASH_ON_DELIVERY"), customerNote: z.string().trim().max(1000).optional() }).parse(request.body);
  const shippingLkr = Number(process.env.FLAT_SHIPPING_LKR);
  if (!Number.isSafeInteger(shippingLkr) || shippingLkr < 0) fail(503, "DELIVERY_NOT_CONFIGURED", "Checkout is not available until delivery pricing is configured.");
  const order = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({ where: { userId: user.id }, include: { items: { include: { variant: { include: { product: true } } } } } });
    if (!cart?.items.length) fail(400, "CART_EMPTY", "Add an item before placing an order.");
    let subtotalLkr = 0;
    for (const item of cart.items) {
      if (!item.variant.active || item.variant.product.status !== "ACTIVE") fail(409, "ITEM_UNAVAILABLE", `${item.variant.product.name} is no longer available.`);
      const reserved = await tx.productVariant.updateMany({ where: { id: item.variantId, stock: { gte: item.quantity }, active: true }, data: { stock: { decrement: item.quantity } } });
      if (!reserved.count) fail(409, "INSUFFICIENT_STOCK", `Not enough stock for ${item.variant.product.name}.`);
      subtotalLkr += item.variant.priceLkr * item.quantity;
    }
    const address = await tx.address.create({ data: { userId: user.id, ...input.address, isDefault: false } });
    const totalLkr = subtotalLkr + shippingLkr;
    const created = await tx.order.create({ data: {
      orderNumber: `NR${Date.now().toString().slice(-9)}${randomBytes(2).toString("hex").toUpperCase()}`,
      userId: user.id, addressId: address.id, paymentMethod: "CASH_ON_DELIVERY", subtotalLkr, shippingLkr, totalLkr,
      customerNote: input.customerNote, shippingRecipient: input.address.recipient, shippingPhone: input.address.phone,
      shippingAddress: [input.address.line1, input.address.line2, input.address.city, input.address.district, input.address.postalCode, "Sri Lanka"].filter(Boolean).join(", "),
      items: { create: cart.items.map(({ variant, quantity }) => ({ variantId: variant.id, productName: variant.product.name, sku: variant.sku, size: variant.size, color: variant.color, unitPriceLkr: variant.priceLkr, quantity, lineTotalLkr: variant.priceLkr * quantity })) },
      payment: { create: { method: "CASH_ON_DELIVERY", amountLkr: totalLkr, status: "PENDING" } }, delivery: { create: {} },
    }, include: { items: true, payment: true, delivery: true } });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } }); return created;
  }, { isolationLevel: "Serializable" });
  response.status(201).json({ order });
}));
app.get("/api/orders", asyncRoute(async (request, response) => {
  const user = requireUser(request); const orders = await prisma.order.findMany({ where: { userId: user.id }, include: { items: true, payment: true, delivery: true }, orderBy: { createdAt: "desc" } }); response.json({ orders });
}));
app.get("/api/orders/:id", asyncRoute(async (request, response) => {
  const user = requireUser(request); const order = await prisma.order.findFirst({ where: { id: request.params.id, userId: user.id }, include: { items: true, payment: true, delivery: true } });
  if (!order) fail(404, "ORDER_NOT_FOUND", "Order was not found."); response.json({ order });
}));

const productInput = z.object({ categoryId: z.string().min(1), name: z.string().trim().min(1).max(191), slug: z.string().trim().min(1).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().max(10000), status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"), featured: z.boolean().default(false), images: z.array(z.object({ url: z.url().max(1000), alt: z.string().max(191).optional() })).max(12).default([]), variants: z.array(z.object({ sku: z.string().trim().min(1).max(80), size: z.string().trim().min(1).max(40), color: z.string().trim().min(1).max(60), priceLkr: z.number().int().positive(), stock: z.number().int().min(0) })).min(1) });
app.get("/api/admin/orders", asyncRoute(async (request, response) => {
  requireStaff(request); const orders = await prisma.order.findMany({ include: { user: { select: { email: true, firstName: true, lastName: true } }, items: true, payment: true, delivery: true }, orderBy: { createdAt: "desc" }, take: 100 }); response.json({ orders });
}));
app.patch("/api/admin/orders/:id/status", asyncRoute(async (request, response) => {
  requireStaff(request); const { status } = z.object({ status: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]) }).parse(request.body);
  const current = await prisma.order.findUnique({ where: { id: request.params.id }, include: { items: true } }); if (!current) fail(404, "ORDER_NOT_FOUND", "Order was not found.");
  const transitions: Record<string, string[]> = { PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PROCESSING", "CANCELLED"], PROCESSING: ["SHIPPED", "CANCELLED"], SHIPPED: ["DELIVERED"], DELIVERED: [], CANCELLED: [], REFUNDED: [] };
  if (!transitions[current.status]?.includes(status)) fail(409, "INVALID_ORDER_TRANSITION", `Cannot change an order from ${current.status} to ${status}.`);
  const updated = await prisma.$transaction(async (tx) => {
    if (status === "CANCELLED") for (const item of current.items) await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
    return tx.order.update({ where: { id: current.id }, data: { status, delivery: status === "SHIPPED" ? { update: { status: "SHIPPED", shippedAt: new Date() } } : status === "DELIVERED" ? { update: { status: "DELIVERED", deliveredAt: new Date() } } : undefined }, include: { items: true, payment: true, delivery: true } });
  }); response.json({ order: updated });
}));
app.post("/api/admin/categories", asyncRoute(async (request, response) => {
  requireStaff(request); const input = z.object({ name: z.string().trim().min(1).max(100), slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }).parse(request.body);
  response.status(201).json({ category: await prisma.category.create({ data: input }) });
}));
app.post("/api/admin/products", asyncRoute(async (request, response) => {
  requireStaff(request); const input = productInput.parse(request.body);
  const product = await prisma.product.create({ data: { categoryId: input.categoryId, name: input.name, slug: input.slug, description: input.description, status: input.status, featured: input.featured, images: { create: input.images.map((image, position) => ({ ...image, position })) }, variants: { create: input.variants } }, include: productInclude });
  response.status(201).json({ product });
}));
app.put("/api/admin/products/:id", asyncRoute(async (request, response) => {
  requireStaff(request); const input = productInput.parse(request.body);
  const product = await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: request.params.id } }); await tx.productVariant.deleteMany({ where: { productId: request.params.id } });
    return tx.product.update({ where: { id: request.params.id }, data: { categoryId: input.categoryId, name: input.name, slug: input.slug, description: input.description, status: input.status, featured: input.featured, images: { create: input.images.map((image, position) => ({ ...image, position })) }, variants: { create: input.variants } }, include: productInclude });
  }); response.json({ product });
}));

app.use("/api", (_request, response) => response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } }));
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) return response.status(400).json({ error: { code: "INVALID_INPUT", message: "Some submitted information is invalid.", details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) } });
  const known = error as Error & { status?: number; code?: string };
  const status = known.status ?? (known.code === "P2002" ? 409 : known.code === "P2025" ? 404 : 500);
  const code = known.code === "P2002" ? "DUPLICATE_VALUE" : known.code === "P2025" ? "NOT_FOUND" : known.code ?? "INTERNAL_ERROR";
  if (status >= 500) console.error("Request failed:", error);
  response.status(status).json({ error: { code, message: status >= 500 ? "An unexpected error occurred." : known.message } });
});
const server = app.listen(port, "0.0.0.0", () => console.log(`NOORA API listening on port ${port}`));
const shutdown = () => { server.close(() => { void prisma.$disconnect().finally(() => process.exit(0)); }); };
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
export default app;

app.use("/api", (_request, response) => response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } }));
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) return response.status(400).json({ error: { code: "INVALID_INPUT", message: "Some submitted information is invalid.", details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) } });
  const known = error as Error & { status?: number; code?: string }; const status = known.status ?? (known.code === "P2002" ? 409 : known.code === "P2025" ? 404 : 500);
  const code = known.code === "P2002" ? "DUPLICATE_VALUE" : known.code === "P2025" ? "NOT_FOUND" : known.code ?? "INTERNAL_ERROR";
  if (status >= 500) console.error("Request failed:", error);
  response.status(status).json({ error: { code, message: status >= 500 ? "An unexpected error occurred." : known.message } });
});
const server = app.listen(port, "0.0.0.0", () => console.log(`NOORA API listening on port ${port}`));
const shutdown = () => { server.close(() => { void prisma.$disconnect().finally(() => process.exit(0)); }); };
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
export default app;
