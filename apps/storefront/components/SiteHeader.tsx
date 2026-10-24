"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type User } from "@/lib/api";

export function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { api<{ user: User | null }>("/api/auth/me").then((data) => setUser(data.user)).catch(() => undefined); }, []);
  return <>
    <div className="announcement">Thoughtful clothing, delivered across Sri Lanka <span>•</span> Prices in LKR</div>
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="NOORA home">NOORA<span className="wordmark-dot">.</span></Link>
      <nav aria-label="Main navigation"><Link href="/shop">Shop</Link><a href="/shop?category=women">Women</a><a href="/shop?category=men">Men</a><a href="/shop?category=children">Children</a></nav>
      <div className="header-actions"><Link href={user ? "/account" : "/account"} className="account-link">{user ? `Hello, ${user.firstName}` : "Sign in"}</Link><Link href="/cart" className="bag-link"><span>Bag</span><span className="bag-icon" aria-hidden="true">↗</span></Link></div>
    </header>
  </>;
}
