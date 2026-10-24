"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, money } from "@/lib/api";
type Order = { id: string; orderNumber: string; status: string; totalLkr: number; createdAt: string; items: { id: string; productName: string; size: string; color: string; quantity: number }[]; delivery?: { trackingNumber?: string | null } | null };
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { api<{ orders: Order[] }>("/api/orders").then(({ orders: result }) => setOrders(result)).catch((problem) => setError(problem instanceof Error ? problem.message : "Sign in to see your orders.")).finally(() => setLoading(false)); }, []);
  return <main className="orders-page"><p className="eyebrow">A little history</p><h1>Your NOORA<br/><em>orders.</em></h1>{loading && <p>Finding your orders…</p>}{error && <div className="empty-state"><p>{error}</p><Link className="button button-dark" href="/account">Sign in <span>↗</span></Link></div>}{!loading && !error && !orders.length && <div className="empty-state"><span className="empty-flower">✳</span><h2>Your next favourite starts here.</h2><p>When you place an order, you’ll find it here.</p><Link className="text-link" href="/shop">Explore the collection <span>→</span></Link></div>}{orders.map((order) => <article className="order-card" key={order.id}><div className="order-card-head"><div><span className="product-category">ORDER {order.orderNumber}</span><h2>{new Date(order.createdAt).toLocaleDateString("en-LK", { year: "numeric", month: "long", day: "numeric" })}</h2></div><span className={`order-status status-${order.status.toLowerCase()}`}>{order.status.toLowerCase()}</span></div><div className="order-lines">{order.items.map((item) => <div key={item.id}><span>{item.productName} · {item.color} / {item.size} × {item.quantity}</span></div>)}</div><div className="order-card-foot"><span>{order.delivery?.trackingNumber ? `Tracking ${order.delivery.trackingNumber}` : "Cash on delivery"}</span><strong>{money(order.totalLkr)}</strong></div></article>)}</main>;
}
