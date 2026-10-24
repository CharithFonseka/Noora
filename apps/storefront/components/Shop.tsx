"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, money, type Product } from "@/lib/api";

function ShopContent() {
  const params = useSearchParams();
  const initialCategory = params.get("category") ?? "";
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); const query = new URLSearchParams(); if (category) query.set("category", category); if (search.trim()) query.set("search", search.trim());
    api<{ products: Product[] }>(`/api/products?${query}`).then((result) => { setProducts(result.products); setError(""); }).catch(() => setError("We couldn’t load the collection. Please refresh in a moment.")).finally(() => setLoading(false));
  }, [category, search]);
  return <main className="shop-page"><div className="shop-heading"><div><p className="eyebrow">The NOORA wardrobe</p><h1>Find your <em>everyday.</em></h1><p>Pieces to live in, and love for a long time.</p></div><span className="shop-count">{products.length} {products.length === 1 ? "piece" : "pieces"}</span></div>
    <div className="shop-toolbar"><div className="category-filters" aria-label="Filter by category">{[["", "All pieces"], ["women", "Women"], ["men", "Men"], ["children", "Children"]].map(([slug, label]) => <button key={slug} className={category === slug ? "filter-button active" : "filter-button"} onClick={() => setCategory(slug)}>{label}</button>)}</div><label className="search-field"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try linen, dresses..."/><span aria-hidden="true">⌕</span></label></div>
    {error && <p className="notice notice-error">{error}</p>}{loading && <p className="empty-state">Finding your favourites…</p>}
    {!loading && !error && !products.length && <div className="empty-state"><span className="empty-flower">✳</span><h2>A little quiet on the rail.</h2><p>New NOORA favourites will be arriving here soon.</p><Link href="/account" className="text-link">Sign in to your account <span>→</span></Link></div>}
    <div className="product-grid">{products.map((product, index) => { const prices = product.variants.map((variant) => variant.priceLkr); const image = product.images[0]; return <Link className="product-card" href={`/shop/${product.slug}`} key={product.id}><div className={`product-image product-image-${index % 4}`}>{image ? <img src={image.url} alt={image.alt || product.name} /> : <span className="image-placeholder">N<span>O</span></span>}{product.featured && <span className="product-badge">NOORA favourite</span>}<span className="product-arrow">↗</span></div><div className="product-meta"><div><span className="product-category">{product.category.name}</span><h2>{product.name}</h2></div><span className="product-price">{prices.length ? money(Math.min(...prices)) : ""}</span></div></Link>; })}</div>
  </main>;
}
export function Shop() { return <Suspense fallback={<main className="shop-page"><p>Opening the collection…</p></main>}><ShopContent /></Suspense>; }
