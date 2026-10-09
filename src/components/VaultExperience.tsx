"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { vaultProducts, changeCartLine, removeCartLine, type CartLine, type VaultProduct } from "@/lib/vault";

type CommerceValue = { cart: CartLine[]; wishlist: string[]; cartCount: number; add: (slug: string, condition: string) => void; remove: (slug: string, condition: string) => void; change: (slug: string, condition: string, quantity: number) => void; toggleSaved: (slug: string) => void; clear: () => void };
const CommerceContext = createContext<CommerceValue | null>(null);
const CART_KEY = "vaeltx-vault-demo-cart-v1";
const WISH_KEY = "vaeltx-vault-demo-wishlist-v1";

export function CommerceProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setCart(JSON.parse(localStorage.getItem(CART_KEY) || "[]") as CartLine[]); setWishlist(JSON.parse(localStorage.getItem(WISH_KEY) || "[]") as string[]); } catch { setCart([]); setWishlist([]); }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart, ready]);
  useEffect(() => { if (ready) localStorage.setItem(WISH_KEY, JSON.stringify(wishlist)); }, [wishlist, ready]);
  const value = useMemo<CommerceValue>(() => ({
    cart, wishlist, cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    add: (slug, condition) => setCart(current => { const match = current.find(item => item.slug === slug && item.condition === condition); return match ? current.map(item => item === match ? { ...item, quantity: Math.min(10, item.quantity + 1) } : item) : [...current, { slug, condition, quantity: 1 }]; }),
    remove: (slug, condition) => setCart(current => removeCartLine(current, slug, condition)),
    change: (slug, condition, quantity) => setCart(current => changeCartLine(current, slug, condition, quantity)),
    toggleSaved: slug => setWishlist(current => current.includes(slug) ? current.filter(item => item !== slug) : [...current, slug]),
    clear: () => setCart([]),
  }), [cart, wishlist]);
  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() { const value = useContext(CommerceContext); if (!value) throw new Error("Vault experience must be wrapped in CommerceProvider."); return value; }

export function CardArt({ product, compact = false }: { product: VaultProduct; compact?: boolean }) {
  return <div className={`vault-card-art vault-card-art-${product.illustration}${compact ? " is-compact" : ""}`} aria-label={product.art} role="img"><span className="card-art-frame"><i/><b>{product.set.toUpperCase()}</b><strong>{product.name}</strong><em>{product.category}</em><small>VAELTX / FICTIONAL CARD ART</small></span><span className="card-art-scene" aria-hidden="true"><i/><b/><em/><span>{product.illustration === "ember" ? "✦" : product.illustration === "heron" ? "◒" : product.illustration === "moss" ? "❋" : "✧"}</span></span></div>;
}

function ProductTile({ product, base, onAdd }: { product: VaultProduct; base: string; onAdd?: (product: VaultProduct) => void }) {
  const { wishlist, toggleSaved } = useCommerce();
  const saved = wishlist.includes(product.slug);
  return <article className="vault-product-tile"><div className="vault-product-media"><Link href={`${base}/cards/${product.slug}`} aria-label={`View ${product.name}`}><CardArt product={product} compact /></Link><button type="button" className="vault-save" aria-pressed={saved} aria-label={saved ? `Remove ${product.name} from saved cards` : `Save ${product.name}`} onClick={() => toggleSaved(product.slug)}>{saved ? "Saved" : "Save"}</button></div><div className="vault-product-meta"><span>{product.set.toUpperCase()} · {product.number}</span><Link href={`${base}/cards/${product.slug}`}>{product.name}</Link><small>{product.condition} · sample state</small><small className="vault-demo-value">DEMO DATA / NOT A PRICE</small>{onAdd && <button type="button" className="vault-quick-add" onClick={() => onAdd(product)}>Add to demo cart <span aria-hidden="true">+</span></button>}</div></article>;
}

export function VaultExperience({ kind, base, product, query = "", collectionName }: { kind: string; base: string; product?: VaultProduct; query?: string; collectionName?: string }) {
  const { cart, cartCount, add, remove, change, clear, wishlist } = useCommerce();
  const [condition, setCondition] = useState(product?.condition ?? "Near mint");
  const [term, setTerm] = useState(query);
  const [setFilter, setSetFilter] = useState(collectionName ?? "All sets");
  const [conditionFilter, setConditionFilter] = useState("All conditions");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const router = useRouter();
  const filterDialog = useRef<HTMLDialogElement>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const matches = vaultProducts.filter(item => (!term || `${item.name} ${item.set} ${item.number} ${item.category}`.toLowerCase().includes(term.toLowerCase())) && (setFilter === "All sets" || item.set === setFilter) && (conditionFilter === "All conditions" || item.condition === conditionFilter));
  const current = product ?? vaultProducts[0];
  const cartLines = cart.map(line => ({ ...line, product: vaultProducts.find(item => item.slug === line.slug) })).filter((line): line is CartLine & { product: VaultProduct } => !!line.product);

  function doAdd(item: VaultProduct, selected = condition) { add(item.slug, selected); setAdded(true); window.setTimeout(() => setAdded(false), 1800); }
  function openFilters() { filterDialog.current?.showModal(); setSheetOpen(true); }
  function closeFilters() { filterDialog.current?.close(); setSheetOpen(false); }
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); router.push(`${base}/search?q=${encodeURIComponent(term)}`); }

  if (kind === "home") return <div className="vault-home-experience"><form className="vault-search-form" onSubmit={search}><label htmlFor="vault-home-search">Search cards, sets or numbers</label><input id="vault-home-search" value={term} onChange={event => setTerm(event.target.value)} placeholder="Try Ember Keeper or 014"/><button type="submit">Search <span aria-hidden="true">⌕</span></button></form><div className="vault-featured-grid">{vaultProducts.slice(0, 3).map(item => <ProductTile key={item.slug} product={item} base={base} onAdd={selected => doAdd(selected, selected.condition)}/>)}</div><p className="vault-demo-note">Original fictional cards · local demo cart · no inventory or payment</p></div>;

  if (kind === "collections") return <div className="vault-collection-grid">{["Ember Archive", "Tidal Index", "Verdant Atlas"].map((name, index) => <Link className={`vault-collection-tile vault-collection-${index + 1}`} key={name} href={`${base}/collections/${name.toLowerCase().replaceAll(" ", "-")}`}><span>0{index + 1} / FICTIONAL SET</span><strong>{name}</strong><small>Original concept art · no real release</small><b aria-hidden="true">↗</b></Link>)}</div>;

  if (kind === "search") return <div className="vault-catalog"><form className="vault-search-form" onSubmit={search}><label htmlFor="vault-search">Search cards, sets or numbers</label><input id="vault-search" value={term} onChange={event => setTerm(event.target.value)} placeholder="Card name, set or number" autoComplete="off"/><button type="submit">Search</button></form><p className="vault-result-count" aria-live="polite">{matches.length} concept {matches.length === 1 ? "result" : "results"} · local demo catalog</p><div className="vault-product-grid">{matches.map(item => <ProductTile key={item.slug} product={item} base={base} onAdd={selected => doAdd(selected, selected.condition)}/>)}</div>{matches.length === 0 && <p className="vault-empty">No exact match. Try a card name, set, number or character.</p>}</div>;

  if (["catalog", "collection"].includes(kind)) return <div className="vault-catalog"><div className="vault-filter-bar"><p className="vault-result-count">{matches.length} fictional cards · sample data only</p><button ref={filterTrigger} type="button" className="vault-filter-trigger" aria-expanded={sheetOpen} onClick={openFilters}>Filter{setFilter !== "All sets" || conditionFilter !== "All conditions" ? " (1)" : ""}</button><label>Set <select value={setFilter} onChange={event => setSetFilter(event.target.value)}><option>All sets</option>{[...new Set(vaultProducts.map(item => item.set))].map(set => <option key={set}>{set}</option>)}</select></label><label>Condition <select value={conditionFilter} onChange={event => setConditionFilter(event.target.value)}><option>All conditions</option>{[...new Set(vaultProducts.map(item => item.condition))].map(value => <option key={value}>{value}</option>)}</select></label></div><div className="vault-product-grid">{matches.map(item => <ProductTile key={item.slug} product={item} base={base} onAdd={selected => doAdd(selected, selected.condition)}/>)}</div>{matches.length === 0 && <p className="vault-empty">No exact match. Clear a filter or choose another condition.</p>}
    <dialog ref={filterDialog} className="vault-filter-sheet" aria-label="Card filters" onClose={() => { setSheetOpen(false); filterTrigger.current?.focus(); }}><div className="vault-sheet-head"><h2>Filter cards</h2><button type="button" onClick={closeFilters} aria-label="Close filters">×</button></div><label>Set<select value={setFilter} onChange={event => setSetFilter(event.target.value)}><option>All sets</option>{[...new Set(vaultProducts.map(item => item.set))].map(set => <option key={set}>{set}</option>)}</select></label><label>Condition<select value={conditionFilter} onChange={event => setConditionFilter(event.target.value)}><option>All conditions</option>{[...new Set(vaultProducts.map(item => item.condition))].map(value => <option key={value}>{value}</option>)}</select></label><button type="button" className="vault-apply-filter" onClick={closeFilters}>View {matches.length} concept cards</button><button type="button" className="vault-clear-filter" onClick={() => { setSetFilter("All sets"); setConditionFilter("All conditions"); }}>Clear filters</button></dialog>
    </div>;

  if (kind === "product") return <div className="vault-product-detail"><div className="vault-product-main-art"><CardArt product={current}/><span className="vault-image-note">ORIGINAL FICTIONAL CONCEPT ART / NOT A REAL CARD</span></div><div className="vault-buy-panel"><span className="vault-product-kicker">{current.set.toUpperCase()} · #{current.number}</span><h2>{current.name}</h2><p className="vault-product-subtitle">{current.category}</p><p className="vault-demo-value">ILLUSTRATIVE STATE / NOT A PRICE</p><fieldset className="vault-condition"><legend>Condition · example selector</legend>{["Near mint", "Light play", "Moderate play"].map(value => <label key={value} className={condition === value ? "is-selected" : ""}><input type="radio" name="condition" checked={condition === value} onChange={() => setCondition(value)}/>{value}</label>)}</fieldset><div className="vault-inventory"><span className="inventory-dot" aria-hidden="true"/>Sample state · no actual inventory</div><button className="vault-add-button" type="button" onClick={() => doAdd(current)}>{added ? "Added to demo cart" : "Add to demo cart"}<span aria-hidden="true">{added ? "✓" : "+"}</span></button><p className="vault-demo-note">Nothing is reserved or purchased. Cart state stays in this browser.</p><details><summary>Condition definitions <b>+</b></summary><p>Condition names are illustrative here. A real store needs its own inspection standard and matching inventory for every selection.</p></details><details><summary>Shipping information <b>+</b></summary><p>No carrier, rate or delivery promise is represented in this concept.</p></details></div></div>;

  if (kind === "cart") return <div className="vault-cart-layout"><div className="vault-cart-lines">{cartLines.length ? cartLines.map(line => <article className="vault-cart-line" key={`${line.slug}:${line.condition}`}><Link href={`${base}/cards/${line.slug}`}><CardArt product={line.product} compact/></Link><div><span>{line.product.set} · {line.product.number}</span><h3>{line.product.name}</h3><p>{line.condition} · demo condition</p><label>Quantity <input type="number" min="1" max="10" aria-label={`${line.product.name} (${line.condition}) quantity`} value={line.quantity} onChange={event => change(line.slug, line.condition, Number(event.target.value))}/></label></div><button type="button" onClick={() => remove(line.slug, line.condition)} aria-label={`Remove ${line.product.name} (${line.condition})`}>Remove</button></article>) : <div className="vault-empty"><span>NO ITEMS / DEMO CART</span><h2>Your cart is empty.</h2><p>Cards added in this browser appear here. No stock is reserved.</p><Link className="vault-outline-button" href={`${base}/cards`}>Browse cards</Link></div>}</div><aside className="vault-cart-summary"><span>ORDER SUMMARY / DEMO</span><h2>{cartCount} {cartCount === 1 ? "item" : "items"}</h2><p>Sample catalog only. No prices, shipping or payment are connected.</p><Link className="vault-checkout-button" href={`${base}/checkout-demo`}>Continue to checkout demo <span aria-hidden="true">↗</span></Link><button type="button" className="vault-clear-filter" onClick={clear} disabled={!cart.length}>Clear demo cart</button></aside></div>;

  if (kind === "account" || kind === "orders") return <div className="vault-account-panel"><div className="vault-account-links"><Link href={`${base}/account/orders`} aria-current={kind === "orders" ? "page" : undefined}>Orders</Link><Link href={`${base}/account/wishlist`}>Wishlist ({wishlist.length})</Link></div>{kind === "orders" ? <div className="vault-empty"><span>ACCOUNT CONCEPT / EMPTY STATE</span><h2>No orders yet.</h2><p>Your future order history would appear here in a real store. This concept has no authentication or payment system.</p><Link href={`${base}/cards`} className="text-link">Continue browsing →</Link></div> : <div className="vault-empty"><span>ACCOUNT CONCEPT / NOT SIGNED IN</span><h2>A collector account, without a real login.</h2><p>No password or personal information is requested. Orders and saved cards remain local interface patterns.</p><div><Link className="vault-outline-button" href={`${base}/account/orders`}>View orders</Link><Link className="text-link" href={`${base}/account/wishlist`}>Saved cards →</Link></div></div>}</div>;

  if (kind === "wishlist") return <div className="vault-catalog">{wishlist.length ? <div className="vault-product-grid">{vaultProducts.filter(item => wishlist.includes(item.slug)).map(item => <ProductTile key={item.slug} product={item} base={base} onAdd={selected => doAdd(selected, selected.condition)}/>)}</div> : <div className="vault-empty"><span>WISHLIST / EMPTY</span><h2>Nothing saved yet.</h2><p>Use the save control on a concept card to keep it here in this browser.</p><Link href={`${base}/cards`} className="text-link">Browse cards →</Link></div>}</div>;

  if (kind === "checkout") return <CheckoutDemo base={base}/>;
  return null;
}

function CheckoutDemo({ base }: { base: string }) {
  const [step, setStep] = useState(0);
  const labels = ["Contact", "Shipping", "Delivery", "Payment demo", "Review"];
  return <div className="vault-checkout"><p className="vault-persistent-demo">CONCEPT CHECKOUT · NO PAYMENT IS PROCESSED</p><ol aria-label="Checkout steps">{labels.map((label, i) => <li key={label} aria-current={step === i ? "step" : undefined}><span>0{i + 1}</span>{label}</li>)}</ol><div className="vault-checkout-step" aria-live="polite"><span>STEP 0{step + 1} / DEMONSTRATION</span><h2>{labels[step]}</h2><p>{["A real store would collect contact information here.", "A real store would confirm an address and eligible service region.", "Delivery choices require a real shipping provider and published rates.", "Payment is intentionally unavailable in this concept.", "No order is created or charged."][step]}</p>{step < labels.length - 1 ? <button className="vault-checkout-button" type="button" onClick={() => setStep(current => current + 1)}>Continue demo <span aria-hidden="true">→</span></button> : <Link className="vault-outline-button" href={`${base}/cart`}>Return to demo cart</Link>}</div><p className="vault-checkout-note">Do not enter real personal, address or payment details. This flow stores nothing.</p></div>;
}
