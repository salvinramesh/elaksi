import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { INR } from "../utils";

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#FFF4E0" offset="0"/>
    <stop stop-color="#FBE0A6" offset="1"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
        font-family="ui-sans-serif, system-ui" font-size="36" fill="#7c5a00" opacity="0.7">ELAKSI ATELIER</text>
</svg>`);

export default function Home() {
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [activeCollection, setActiveCollection] = useState("all");

  const collectionsRef = useRef(null);
  const productsRef = useRef(null);

  useEffect(() => { fetch("/api/collections").then(r => r.json()).then(setCollections); }, []);
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (activeCollection !== "all") params.set("collectionId", activeCollection);
    fetch("/api/products?" + params.toString()).then(r => r.json()).then(setProducts);
  }, [q, activeCollection]);

  const scrollToCollections = () =>
    collectionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToProducts = () =>
    productsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <Hero onShop={scrollToProducts} onExplore={scrollToCollections} />

      <section ref={collectionsRef} id="collections" className="mt-8">
        <div className="mb-3 font-semibold text-stone-800">Collections</div>
        <div className="flex flex-wrap gap-2">
          <button
            className={`badge ${activeCollection === "all" ? "ring-2 ring-amber-400" : ""}`}
            onClick={() => { setActiveCollection("all"); scrollToProducts(); }}
          >All</button>
          {collections.map(c => (
            <button
              key={c.id}
              className={`badge ${activeCollection === c.id ? "ring-2 ring-amber-400" : ""}`}
              onClick={() => { setActiveCollection(c.id); scrollToProducts(); }}
              title={c.description || c.name}
            >
              {c.name}
            </button>
          ))}
        </div>
      </section>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <input
              className="input pl-9"
              placeholder="Search jewelry"
              value={q}
              onChange={(e)=>setQ(e.target.value)}
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
          </div>
          <select
            className="input w-56"
            value={activeCollection}
            onChange={(e)=>setActiveCollection(e.target.value)}
          >
            <option value="all">All Collections</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="text-sm text-stone-600">Free shipping in India over ₹150</div>
      </div>

      {/* Products */}
      <section ref={productsRef} id="new" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {products.length === 0 ? (
          <div className="col-span-full text-center text-stone-500 border rounded-xl p-10">
            No products yet. Please add items in <code>/admin</code>.
          </div>
        ) : products.map(p => {
          const out = (p.inventory ?? 0) <= 0;
          return (
            <div key={p.id} className="card overflow-hidden transition hover:shadow-md">
              <Link to={`/product/${p.slug}`} className="block">
                <div className="relative">
                  <img
                    src={p.imageUrl || p.images?.[0]?.url || PLACEHOLDER}
                    alt={p.name}
                    className="aspect-square w-full object-cover"
                    onError={(e)=>{ e.currentTarget.src = PLACEHOLDER; }}
                  />
                  {p.collectionId && (
                    <span className="badge absolute left-2 top-2">
                      {collections.find(c=>c.id===p.collectionId)?.name}
                    </span>
                  )}
                  {out && (
                    <span className="absolute right-2 top-2 rounded-full bg-stone-800/90 text-white text-xs px-2 py-1">
                      Out of stock
                    </span>
                  )}
                </div>
              </Link>
              <div className="p-3">
                <div className="font-semibold line-clamp-1">{p.name}</div>
                <div className="text-sm text-stone-600 line-clamp-2">{p.description}</div>
                <div className="mt-2 flex items-center justify-between">
                  <Price price={p.price} compareAt={p.compareAt} />
                  <Link
                    to={`/product/${p.slug}`}
                    className={`btn btn-primary ${out ? "pointer-events-none opacity-50" : ""}`}
                    aria-disabled={out}
                  >
                    {out ? "Sold out" : "View"}
                  </Link>
                </div>
                {!out && typeof p.inventory === "number" && p.inventory <= 2 && (
                  <div className="mt-1 text-xs text-amber-700">Hurry! Only {p.inventory} left</div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

function Hero({ onShop, onExplore }) {
  return (
    <section
      className="relative h-[520px] md:h-[600px] rounded-2xl overflow-hidden flex items-center justify-center text-center"
      style={{
        backgroundImage: "url('/images/brand-hero.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black/20 md:bg-black/25" />
      <div className="relative z-10 flex flex-col items-center justify-center px-4 text-white">
        <img src="/images/logo.png" alt="ELAKSI ATELIER" className="h-20 md:h-28 mb-4 drop-shadow" />
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow">
          ELAKSI ATELIER
        </h1>
        <p className="mt-3 md:mt-4 text-base md:text-lg max-w-3xl drop-shadow">
          Handpicked imitation jewelry crafted for everyday radiance and bridal grandeur.
        </p>
        <div className="mt-6 flex gap-4 flex-wrap justify-center">
          <button type="button" className="btn btn-primary" onClick={onShop}>
            Shop New Arrivals
          </button>
          <button type="button" className="btn btn-outline" onClick={onExplore}>
            Explore Collections
          </button>
        </div>
      </div>
    </section>
  );
}

function Price({ price, compareAt }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-semibold">{INR.format((price || 0) / 100)}</span>
      {compareAt && compareAt > price ? (
        <span className="text-sm text-stone-500 line-through">{INR.format(compareAt / 100)}</span>
      ) : null}
    </div>
  );
}
