export const apiBase = (typeof window === "undefined" ? process.env.API_URL : process.env.NEXT_PUBLIC_API_URL) ?? "http://localhost:4000";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (response.status === 204) return undefined as T;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "Something went wrong. Please try again.");
  return result as T;
}

export type ProductVariant = { id: string; sku: string; size: string; color: string; priceLkr: number; stock: number };
export type Product = {
  id: string; name: string; slug: string; description: string; featured: boolean;
  category: { id: string; name: string; slug: string };
  images: { id: string; url: string; alt?: string | null }[];
  variants: ProductVariant[];
};
export type User = { id: string; email: string; firstName: string; lastName: string; role: "CUSTOMER" | "STAFF" | "ADMIN"; mfaEnabled: boolean };
export const money = (amount: number) => new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(amount);
