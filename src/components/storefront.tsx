"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChefHat, ChevronDown, ChevronLeft, ChevronRight, Clock3, CreditCard, LogOut, MapPin, Minus, Plus, ReceiptText, ShoppingBag, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { formatCurrency } from "@/lib/money";
import { CustomerAccess } from "@/components/customer-access";
import { InstagramLogo, WhatsAppLogo } from "@/components/social-icons";
import { buildCategoryMarqueeItems, buildCategoryTiles, selectShowcaseProducts } from "@/lib/storefront-presentation";
import type { CartLine, Catalog, CheckoutInput, CustomerAccount, Product } from "@/lib/types";

const emptyCatalog: Catalog = {
  categories: [], products: [], deliveryZones: [], defaultDeliveryFeeCents: 800, acceptingOrders: false, pixConfigured: false, whatsappConfigured: false, hoursLabel: "Carregando…", workingHours: [],
};

const WHATSAPP_PENDING_URL = "https://wa.me/[PENDENTE-CLIENTE]";

function linePrice(line: CartLine, catalog: Catalog) {
  const product = catalog.products.find((item) => item.id === line.productId);
  if (!product) return 0;
  const choices = product.optionGroups.flatMap((group) => group.options).filter((option) => line.optionIds.includes(option.id));
  return (product.priceCents + choices.reduce((sum, choice) => sum + choice.priceCents, 0)) * line.quantity;
}

function defaultOptions(product: Product) {
  return product.optionGroups.flatMap((group) => group.options.filter((option) => option.isAvailable).slice(0, group.minSelections).map((option) => option.id));
}

function productVisualTreatment(product: Product) {
  const text = `${product.name} ${product.description}`.toLocaleLowerCase("pt-BR");
  if (text.includes("monstro")) return { tone: "monster", label: "Mais robusto" };
  if ((product.categoryId === "tradicionais" || product.categoryId === "prensadoes") && text.includes("duplo")) return { tone: "double", label: "Duplo" };
  if (product.categoryId === "dog-no-pote" && text.includes("bacon")) return { tone: "bacon", label: "Bacon" };
  if (product.categoryId === "dog-no-pote" && text.includes("calabresa")) return { tone: "calabresa", label: "Calabresa" };
  if (product.categoryId === "dog-no-pote" && text.includes("especial")) return { tone: "special", label: "Especial" };
  if (product.categoryId === "dog-no-pote" && text.includes("simples")) return { tone: "simple", label: "Simples" };
  if (product.categoryId === "porcoes" && text.includes("completa")) return { tone: "portion-complete", label: "Completa" };
  if (product.categoryId === "porcoes" && text.includes("simples")) return { tone: "portion", label: "Simples" };
  if (text.includes("alcatra") || text.includes("picanha")) return { tone: "grill", label: "Cortes nobres" };
  if (text.includes("bacon")) return { tone: "bacon", label: "Bacon" };
  if (text.includes("calabresa")) return { tone: "calabresa", label: "Calabresa" };
  if (text.includes("catupiry") || text.includes("cheddar") || text.includes("mussarela")) return { tone: "cheese", label: "Queijos" };
  if (product.categoryId === "combos") return { tone: "combo", label: "Combo" };
  if (product.categoryId === "dog-no-pote" || text.includes("gratinado")) return { tone: "gratinado", label: "Gratinado" };
  if (product.categoryId === "porcoes" || text.includes("porção")) return { tone: "portion", label: "Para compartilhar" };
  if (product.categoryId === "bebidas" && text.includes("cerveja")) return { tone: "beer", label: "Cerveja" };
  if (product.categoryId === "bebidas" && text.includes("suco")) return { tone: "juice", label: "Suco" };
  if (product.categoryId === "bebidas" && text.includes("água")) return { tone: "water", label: "Água" };
  if (product.categoryId === "bebidas" && (text.includes("refrigerante") || text.includes("coca-cola"))) return { tone: "soda", label: "Refrigerante" };
  if (product.categoryId === "bebidas" || text.includes("refrigerante") || text.includes("suco") || text.includes("água")) return { tone: "drink", label: "Gelada" };
  if (product.categoryId === "prensadoes") return { tone: "pressed", label: "Prensado" };
  return { tone: "classic", label: "Clássico" };
}

export function Storefront() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [heroCarouselPaused, setHeroCarouselPaused] = useState(false);
  const heroPauseTimer = useRef<number | null>(null);
  const [categoryCarouselPaused, setCategoryCarouselPaused] = useState(false);
  const categoryPauseTimer = useRef<number | null>(null);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", deliveryType: "delivery" as "delivery" | "pickup", paymentMethod: "cash" as "pix" | "cash" | "card",
    street: "", number: "", neighborhood: "", complement: "", reference: "",
  });
  const [heroIndex, setHeroIndex] = useState(0);
  const showcaseProducts = useMemo(() => selectShowcaseProducts(catalog.products), [catalog.products]);
  const heroProduct = showcaseProducts.length ? showcaseProducts[heroIndex % showcaseProducts.length] : null;
  const featuredProducts = showcaseProducts.slice(0, 4);
  const categoryTiles = useMemo(() => buildCategoryTiles(catalog.categories, catalog.products), [catalog.categories, catalog.products]);
  const categoryMarqueeItems = useMemo(() => buildCategoryMarqueeItems(categoryTiles), [categoryTiles]);

  useEffect(() => {
    const restoreReturnState = window.setTimeout(() => {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get("checkout") === "1") setCheckout(true);
      if (currentUrl.searchParams.get("account") === "1") setAccountOpen(true);
      if (currentUrl.searchParams.has("checkout") || currentUrl.searchParams.has("account")) {
        currentUrl.searchParams.delete("checkout");
        currentUrl.searchParams.delete("account");
        window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
      }
    }, 0);
    fetch("/api/v1/menu")
      .then((response) => response.json())
      .then((data: Catalog) => setCatalog(data))
      .catch(() => setFormError("Não conseguimos carregar o cardápio. Atualize a página para tentar novamente."));
    fetch("/api/v1/customer/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { customer: CustomerAccount | null }) => { if (data.customer) handleCustomerAuth(data.customer); })
      .catch(() => undefined);
    const restoreCart = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("dogchef-cart");
        if (saved) setCart(JSON.parse(saved) as CartLine[]);
      } catch { /* an empty cart is safe fallback */ }
    }, 0);
    return () => { window.clearTimeout(restoreReturnState); window.clearTimeout(restoreCart); };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("dogchef-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (showcaseProducts.length < 2 || heroCarouselPaused) return;
    let timer: number | null = null;
    const start = () => {
      if (document.visibilityState !== "visible" || timer !== null) return;
      timer = window.setInterval(() => setHeroIndex((current) => (current + 1) % showcaseProducts.length), 4_800);
    };
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [heroCarouselPaused, showcaseProducts.length]);

  useEffect(() => () => {
    if (heroPauseTimer.current) window.clearTimeout(heroPauseTimer.current);
    if (categoryPauseTimer.current) window.clearTimeout(categoryPauseTimer.current);
  }, []);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".dogchef-store .menu-reveal"));
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -24px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [catalog, activeCategory]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + linePrice(line, catalog), 0), [cart, catalog]);
  const totalItems = cart.reduce((sum, line) => sum + line.quantity, 0);
  const visibleCategories = catalog.categories.filter((category) => activeCategory === "all" || category.id === activeCategory);

  function openProduct(product: Product) {
    if (!product.isAvailable) return;
    setSelectedProduct(product);
    setSelectedImageUrl(product.imageUrl);
    setSelectedOptions(defaultOptions(product));
    setNote("");
  }

  function selectCategory(categoryId: string) {
    pauseCategoryCarousel();
    setActiveCategory(categoryId);
    window.setTimeout(() => {
      const target = document.getElementById(categoryId === "all" ? "dogchef-menu-list" : `category-${categoryId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function pauseHeroCarousel() {
    setHeroCarouselPaused(true);
    if (heroPauseTimer.current) window.clearTimeout(heroPauseTimer.current);
    heroPauseTimer.current = window.setTimeout(() => {
      setHeroCarouselPaused(false);
      heroPauseTimer.current = null;
    }, 7_000);
  }

  function pauseCategoryCarousel() {
    setCategoryCarouselPaused(true);
    if (categoryPauseTimer.current) window.clearTimeout(categoryPauseTimer.current);
    categoryPauseTimer.current = window.setTimeout(() => {
      setCategoryCarouselPaused(false);
      categoryPauseTimer.current = null;
    }, 4_800);
  }

  function handleCustomerAuth(account: CustomerAccount) {
    setCustomer(account);
    setForm((current) => ({ ...current, name: account.name, phone: account.phone, email: account.email }));
    setFormError("");
  }

  async function logoutCustomer() {
    await fetch("/api/v1/customer/logout", { method: "POST" });
    setCustomer(null);
    setAccountOpen(false);
  }

  function toggleOption(optionId: string, groupId: string) {
    if (!selectedProduct) return;
    const group = selectedProduct.optionGroups.find((item) => item.id === groupId)!;
    const inGroup = selectedOptions.filter((id) => group.options.some((option) => option.id === id));
    if (selectedOptions.includes(optionId)) {
      if (inGroup.length <= group.minSelections) return;
      setSelectedOptions((current) => current.filter((id) => id !== optionId));
      return;
    }
    if (inGroup.length >= group.maxSelections) return;
    setSelectedOptions((current) => [...current, optionId]);
  }

  function addConfiguredProduct() {
    if (!selectedProduct) return;
    const missing = selectedProduct.optionGroups.some((group) => group.options.filter((option) => selectedOptions.includes(option.id)).length < group.minSelections);
    if (missing) { setFormError("Escolha as opções obrigatórias antes de adicionar."); return; }
    const key = `${selectedProduct.id}:${[...selectedOptions].sort().join(",")}:${note}`;
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) return current.map((line) => line.key === key ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { key, productId: selectedProduct.id, quantity: 1, optionIds: selectedOptions, note: note || undefined }];
    });
    setSelectedProduct(null);
    setFormError("");
    if (!customer) { setFormError("Entre ou crie sua conta para finalizar o pedido."); return; }
  }

  function updateQuantity(key: string, delta: number) {
    setCart((current) => current.flatMap((line) => {
      if (line.key !== key) return [line];
      const quantity = line.quantity + delta;
      return quantity > 0 ? [{ ...line, quantity }] : [];
    }));
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!cart.length) { setFormError("Adicione ao menos um item ao carrinho."); return; }
    if (form.deliveryType === "delivery" && (!form.street || !form.number || !form.neighborhood)) {
      setFormError("Preencha o endereço completo para calcular a entrega."); return;
    }
    if (form.phone.replace(/\D/g, "").length < 10) {
      setFormError("Informe um telefone válido para concluir o pedido."); return;
    }
    setIsSubmitting(true);
    const payload: CheckoutInput = {
      clientReference: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      customer: {
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        address: form.deliveryType === "delivery" ? { street: form.street, number: form.number, neighborhood: form.neighborhood, complement: form.complement || undefined, reference: form.reference || undefined } : undefined,
      },
      deliveryType: form.deliveryType,
      paymentMethod: form.paymentMethod,
      items: cart,
    };
    try {
      if (customer && !customer.profileComplete) {
        const profileResponse = await fetch("/api/v1/customer/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: form.phone }),
        });
        const profileData = await profileResponse.json();
        if (!profileResponse.ok) throw new Error(profileData.details?.[0] || profileData.error || "Não foi possível salvar seu telefone.");
        handleCustomerAuth(profileData.customer as CustomerAccount);
      }
      const response = await fetch("/api/v1/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar o pedido.");
      window.localStorage.removeItem("dogchef-cart");
      setCart([]);
      router.push(data.trackingUrl);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível enviar o pedido.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="store-shell dogchef-store storefront-reference-redesign">
      <div className="store-utility-bar">
        <div className="store-utility-inner">
          <span><Clock3 size={13}/>{catalog.hoursLabel}</span>
          <span><MapPin size={13}/>Retirada ou entrega</span>
          <a href="https://www.instagram.com/dogdochef_prensado/" target="_blank" rel="noreferrer"><InstagramLogo size={13}/>Siga no Instagram</a>
        </div>
      </div>

      <header className="store-header" id="inicio">
        <a className="brand-lockup" href="#inicio" aria-label="Dog do Chef, início"><span className="brand-mark"><ChefHat size={23}/></span><span><strong>Dog do Chef</strong><small>hot dog prensado</small></span></a>
        <nav className="store-main-nav" aria-label="Navegação principal">
          <a href="#inicio">Início</a>
          <a href="#cardapio">Cardápio</a>
          <a href="#destaques">Destaques</a>
          <a href="#sobre">Sobre nós</a>
        </nav>
        <div className="store-header-actions">
          <button className="icon-button account-button" aria-label={customer ? "Abrir minha conta" : "Entrar na minha conta"} onClick={() => setAccountOpen(true)}><UserRound size={19}/></button>
          <button className="header-cart-button" aria-label={`Abrir carrinho, ${totalItems} itens, total ${formatCurrency(subtotal)}`} onClick={() => setCartOpen(true)}><ShoppingBag size={20}/><span><small>{totalItems} {totalItems === 1 ? "item" : "itens"}</small><strong>{formatCurrency(subtotal)}</strong></span>{totalItems > 0 && <b className="cart-count">{totalItems}</b>}</button>
        </div>
      </header>

      <section
        className="hero dogchef-hero menu-reveal menu-reveal--title"
        aria-roledescription="carrossel"
        aria-label="Destaques do cardápio"
        onPointerDown={pauseHeroCarousel}
        onMouseEnter={pauseHeroCarousel}
        onFocusCapture={pauseHeroCarousel}
        onKeyDown={(event) => {
          if (showcaseProducts.length < 2) return;
          if (event.key === "ArrowLeft") {
            pauseHeroCarousel();
            setHeroIndex((current) => (current - 1 + showcaseProducts.length) % showcaseProducts.length);
          }
          if (event.key === "ArrowRight") {
            pauseHeroCarousel();
            setHeroIndex((current) => (current + 1) % showcaseProducts.length);
          }
        }}
      >
        <div className="showcase-slides" aria-live="off">
          {showcaseProducts.length ? showcaseProducts.map((product, index) => <Image key={product.id} className={index === heroIndex % showcaseProducts.length ? "showcase-slide is-active" : "showcase-slide"} src={product.imageUrl} alt="" fill priority={index === 0} loading={index === 0 ? "eager" : "lazy"} sizes="(max-width: 760px) 100vw, 58vw" aria-hidden="true"/>) : <Image className="showcase-slide is-active" src="/images/dogchef/hero-dog-do-chef.webp" alt="" fill priority loading="eager" sizes="(max-width: 760px) 100vw, 58vw" aria-hidden="true"/>}
        </div>
        <span className="showcase-shade" aria-hidden="true"/>
        <div className="hero-content">
          <p className="eyebrow"><span className={catalog.acceptingOrders ? "dot" : "dot paused"}/> {catalog.acceptingOrders ? "Pedidos abertos" : "Loja pausada"}</p>
          <div className="hero-title-motion" key={heroProduct?.id ?? "dogchef-showcase"}>
            <p className="showcase-kicker">Dog do Chef</p>
            <h1><span>Hot dog</span> <em>prensado</em> <span>feito na hora.</span></h1>
          </div>
          <div className="hero-featured-copy"><strong>{heroProduct?.name ?? "Cardápio Dog do Chef"}</strong><p>{heroProduct?.description || "Hot dogs, gratinados, porções e bebidas para pedir pelo celular."}</p></div>
          <div className="showcase-actions"><button className="button button-primary" disabled={!heroProduct || !catalog.acceptingOrders} onClick={() => heroProduct && openProduct(heroProduct)}>Pedir agora <Plus size={17}/></button><a className="button button-outline" href="#cardapio">Ver cardápio <ChevronDown size={17}/></a>{heroProduct && <strong>{formatCurrency(heroProduct.priceCents)}</strong>}</div>
          <div className="hero-meta"><span><Clock3 size={15}/>{catalog.hoursLabel}</span><span><MapPin size={15}/>Entrega padrão {formatCurrency(catalog.defaultDeliveryFeeCents)}</span></div>
        </div>
        {showcaseProducts.length > 1 && <div className="showcase-controls"><button onClick={() => { pauseHeroCarousel(); setHeroIndex((current) => (current - 1 + showcaseProducts.length) % showcaseProducts.length); }} aria-label="Destaque anterior"><ChevronLeft size={19}/></button><div role="tablist" aria-label="Escolher destaque">{showcaseProducts.map((product, index) => <button key={product.id} className={index === heroIndex % showcaseProducts.length ? "showcase-dot is-active" : "showcase-dot"} onClick={() => { pauseHeroCarousel(); setHeroIndex(index); }} aria-label={`Ver ${product.name}`} aria-selected={index === heroIndex % showcaseProducts.length} role="tab"/>)}</div><button onClick={() => { pauseHeroCarousel(); setHeroIndex((current) => (current + 1) % showcaseProducts.length); }} aria-label="Próximo destaque"><ChevronRight size={19}/></button></div>}
      </section>

      <section className="category-marquee menu-reveal" id="cardapio" aria-labelledby="category-title">
        <div className="category-marquee-heading"><span aria-hidden="true">Explore</span><strong id="category-title">Escolha sua categoria</strong></div>
        <nav className={categoryCarouselPaused ? "category-carousel is-paused" : "category-carousel"} aria-label="Categorias" onPointerDown={pauseCategoryCarousel} onWheel={pauseCategoryCarousel} onMouseEnter={pauseCategoryCarousel} onFocusCapture={pauseCategoryCarousel}>
          <div className="category-carousel-viewport">
            <div className="category-track">
              {categoryMarqueeItems.map((tile) => <button key={tile.key} className={`category-tile category-tile--${tile.id} ${activeCategory === tile.id ? "active" : ""}`} onClick={() => selectCategory(tile.id)} aria-pressed={activeCategory === tile.id} aria-hidden={tile.isDuplicate || undefined} tabIndex={tile.isDuplicate ? -1 : undefined}>
                {tile.cover ? <span className="category-tile-image"><Image src={tile.cover} alt="" fill sizes="120px"/></span> : <span className="category-tile-icon"><ChefHat size={25}/></span>}
                <span className="category-tile-copy"><b>{tile.name}</b><small>{tile.count} itens</small></span>
              </button>)}
            </div>
          </div>
        </nav>
      </section>

      <div className="storefront-tone-flow">
      {featuredProducts.length > 0 && <section className="featured-section featured-band menu-reveal menu-reveal--title" id="destaques" aria-labelledby="featured-title">
        <div className="featured-section-inner">
          <header className="section-heading"><div><p className="eyebrow">Selecionados no Showcase</p><h2 id="featured-title">Destaques da casa</h2></div><a href="#dogchef-menu-list">Ver cardápio completo <ChevronRight size={16}/></a></header>
          <div className="featured-grid">{featuredProducts.map((product) => { const visual = productVisualTreatment(product); return <article key={product.id} className={`featured-card featured-card--${product.categoryId} featured-card--visual-${visual.tone}`}>
            <button className="featured-card-media" onClick={() => openProduct(product)} aria-label={`Ver ${product.name}`}><Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 619px) 50vw, (max-width: 1023px) 33vw, 260px"/><span className="featured-visual-badge" aria-hidden="true">{visual.label}</span></button>
            <div><small>{product.highlight || "Destaque"}</small><h3>{product.name}</h3><p>{product.description}</p><footer><strong>{formatCurrency(product.priceCents)}</strong><button className="round-add" onClick={() => openProduct(product)} aria-label={`Adicionar ${product.name}`}><Plus size={17}/></button></footer></div>
          </article>; })}</div>
        </div>
      </section>}

      <div className="storefront-dark-flow">
      <section className="menu-section dogchef-menu" id="dogchef-menu-list">
        <div className="section-heading menu-reveal menu-reveal--title"><div><p className="eyebrow">Cardápio completo</p><h2>Escolha seu favorito</h2></div><button className="menu-all-filter" onClick={() => selectCategory("all")}>Ver todas as categorias</button></div>
        {visibleCategories.map((category) => {
          const categoryProducts = catalog.products.filter((product) => product.categoryId === category.id);
          return <section key={category.id} className="dogchef-menu-section" aria-labelledby={`category-${category.id}`}>
            <header className="dogchef-menu-section__header menu-reveal menu-reveal--title"><div><p className="eyebrow">{category.description}</p><h3 id={`category-${category.id}`}>{category.name}</h3></div><span>{categoryProducts.filter((product) => product.isAvailable).length} itens</span></header>
            <div className="product-grid">
              {categoryProducts.map((product) => { const visual = productVisualTreatment(product); return <article key={product.id} className={`product-card product-card--${product.categoryId} product-card--visual-${visual.tone} menu-reveal ${!product.isAvailable ? "unavailable" : ""}`}>
                <div className={`product-image product-image--${product.categoryId} product-image--visual-${visual.tone}`}><span className="product-image-frame"><Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 619px) 100vw, (max-width: 919px) 50vw, 33vw"/></span><span className="product-visual-badge" aria-hidden="true">{visual.label}</span>{product.featured && <span className="pill">{product.highlight ?? "Destaque"}</span>}</div>
                <div className="product-copy"><h3>{product.name}</h3>{product.description && <p>{product.description}</p>}</div>
                <div className="product-bottom"><strong>{formatCurrency(product.priceCents)}</strong><button className="round-add" disabled={!product.isAvailable} onClick={() => openProduct(product)} aria-label={`Adicionar ${product.name}`}><Plus size={19}/></button></div>
                {!product.isAvailable && <span className="sold-out">indisponível agora</span>}
              </article>; })}
            </div>
          </section>;
        })}
      </section>

      </div>

      <section className="about-store menu-reveal" id="sobre" aria-labelledby="about-title">
        <div className="about-store-copy"><p className="eyebrow">Sobre nós</p><h2 id="about-title">O sabor do prensado, do seu jeito.</h2><p>O cardápio da Dog do Chef reúne hot dogs tradicionais, prensados, gratinados, combos, porções e bebidas. Escolha os adicionais, defina retirada ou entrega e acompanhe tudo pela sua conta.</p><a className="button button-primary" href="#cardapio">Escolher meu pedido <ChevronRight size={17}/></a></div>
        <div className="about-store-media"><Image src="/images/dogchef/hero-dog-do-chef.webp" alt="Hot dog prensado da Dog do Chef com acompanhamento" fill sizes="(max-width: 760px) 100vw, 54vw"/></div>
      </section>
      </div>

      <footer className="store-footer">
        <div className="store-footer-brand"><div className="brand-lockup"><span className="brand-mark"><ChefHat size={20}/></span><span><strong>Dog do Chef</strong><small>hot dog prensado</small></span></div><p>Cardápio online com adicionais, retirada, entrega e acompanhamento do pedido.</p></div>
        <div className="store-footer-service"><span>Atendimento</span><strong>{catalog.hoursLabel}</strong><small>Entrega padrão {formatCurrency(catalog.defaultDeliveryFeeCents)}</small></div>
        <div className="store-footer-contact"><span>Canais da loja</span><a href="https://www.instagram.com/dogdochef_prensado/" target="_blank" rel="noreferrer"><InstagramLogo size={17}/>@dogdochef_prensado</a><a className={catalog.whatsappConfigured ? "store-footer-whatsapp" : "store-footer-whatsapp is-pending"} href={catalog.whatsappUrl || WHATSAPP_PENDING_URL} target="_blank" rel="noreferrer" aria-label="Falar com a loja pelo WhatsApp" onClick={(event) => { if (!catalog.whatsappConfigured) event.preventDefault(); }}><WhatsAppLogo size={17}/>{catalog.whatsappConfigured ? "WhatsApp da loja" : "WhatsApp em configuração"}</a></div>
        <nav className="store-footer-links" aria-label="Informações da loja"><Link href="/politica-de-privacidade">Privacidade</Link><Link href="/termos-de-uso">Termos de uso</Link></nav>
      </footer>

      {totalItems > 0 && <button className="floating-cart" onClick={() => setCartOpen(true)}><span><ShoppingBag size={19}/>{totalItems} {totalItems === 1 ? "item" : "itens"}</span><strong>{formatCurrency(subtotal)}</strong></button>}
      <div className={totalItems > 0 ? "dogchef-social-stack with-cart" : "dogchef-social-stack"} aria-label="Canais da loja">
        <a className="dogchef-social-button dogchef-social-button--instagram" href="https://www.instagram.com/dogdochef_prensado/" target="_blank" rel="noreferrer" aria-label="Instagram da Dog do Chef" title="Instagram"><InstagramLogo size={20}/></a>
        <a className={!catalog.whatsappConfigured ? "dogchef-social-button dogchef-social-button--whatsapp is-pending" : "dogchef-social-button dogchef-social-button--whatsapp"} href={catalog.whatsappUrl || WHATSAPP_PENDING_URL} target="_blank" rel="noreferrer" aria-label="Falar com a loja pelo WhatsApp" title={catalog.whatsappConfigured ? "WhatsApp" : "WhatsApp aguardando número comercial"} onClick={(event) => { if (!catalog.whatsappConfigured) event.preventDefault(); }}><WhatsAppLogo size={21}/></a>
      </div>

      {accountOpen && <div className="overlay" role="dialog" aria-modal="true" aria-label="Minha conta"><div className="bottom-sheet account-sheet"><button className="sheet-close" onClick={() => setAccountOpen(false)} aria-label="Fechar"><X size={21}/></button>{customer ? <div className="account-menu"><p className="eyebrow">Sua conta</p><h2>Olá, {customer.name.split(" ")[0]}</h2><p>{customer.email}</p>{!customer.profileComplete && <small className="account-profile-pending">Telefone pendente. Complete no checkout ou em Meus pedidos.</small>}<Link className="button button-primary full" href="/meus-pedidos"><ReceiptText size={17}/>Meus pedidos</Link><button className="button button-ghost full" onClick={logoutCustomer}><LogOut size={17}/>Sair da conta</button></div> : <CustomerAccess googleReturnTo="/?account=1" onAuthenticated={(account) => { handleCustomerAuth(account); setAccountOpen(false); }}/>}</div></div>}

      {selectedProduct && <div className="overlay" role="dialog" aria-modal="true" aria-label={`Personalizar ${selectedProduct.name}`}>
        <div className="bottom-sheet configurator">
          <button className="sheet-close" onClick={() => setSelectedProduct(null)} aria-label="Fechar"><X size={21}/></button>
          <div className="product-detail-media"><div className="product-detail-image"><Image src={selectedImageUrl || selectedProduct.imageUrl} alt={selectedProduct.name} fill sizes="(max-width: 650px) 100vw, 650px" priority/></div>{selectedProduct.images.length > 1 && <div className="product-detail-thumbnails" aria-label="Fotos do produto">{selectedProduct.images.map((image) => <button key={image.id} className={(selectedImageUrl || selectedProduct.imageUrl) === image.url ? "is-active" : ""} onClick={() => setSelectedImageUrl(image.url)} aria-label="Ver outra foto do produto"><Image src={image.url} alt="" fill sizes="64px"/></button>)}</div>}</div><p className="eyebrow">Personalize</p><h2>{selectedProduct.name}</h2><p className="muted">{selectedProduct.description}</p>
          {selectedProduct.optionGroups.map((group) => <fieldset key={group.id} className="option-group"><legend>{group.name}<small>{group.required ? "obrigatório" : `até ${group.maxSelections}`}</small></legend>{group.options.filter((option) => option.isAvailable).map((option) => <label key={option.id} className="option-row"><span><input type={group.maxSelections === 1 ? "radio" : "checkbox"} name={group.id} checked={selectedOptions.includes(option.id)} onChange={() => toggleOption(option.id, group.id)}/><b>{option.name}</b></span><em>{option.priceCents ? `+ ${formatCurrency(option.priceCents)}` : "incluído"}</em></label>)}</fieldset>)}
          <label className="field"><span>Observação para a cozinha</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: sem cebola" maxLength={240}/></label>
          <button className="button button-primary full" onClick={addConfiguredProduct}>Adicionar ao carrinho <span>{formatCurrency((selectedProduct.priceCents + selectedProduct.optionGroups.flatMap((group) => group.options).filter((option) => selectedOptions.includes(option.id)).reduce((sum, option) => sum + option.priceCents, 0)))}</span></button>
        </div>
      </div>}

      {cartOpen && <div className="overlay" role="dialog" aria-modal="true" aria-label="Seu carrinho"><div className="bottom-sheet cart-sheet"><div className="sheet-title"><button className="icon-button bare" onClick={() => setCartOpen(false)} aria-label="Voltar"><ArrowLeft size={21}/></button><h2>Seu pedido</h2><span>{totalItems} itens</span></div>{cart.length === 0 ? <div className="empty-state"><ShoppingBag size={30}/><p>Seu carrinho está vazio.</p></div> : <><div className="cart-lines">{cart.map((line) => { const product = catalog.products.find((item) => item.id === line.productId); const optionNames = product?.optionGroups.flatMap((group) => group.options).filter((option) => line.optionIds.includes(option.id)).map((option) => option.name); return <div className="cart-line" key={line.key}><div><b>{product?.name}</b>{optionNames?.length ? <small>{optionNames.join(", ")}</small> : null}{line.note && <small>Obs.: {line.note}</small>}<strong>{formatCurrency(linePrice({ ...line, quantity: 1 }, catalog))}</strong></div><div className="quantity"><button onClick={() => updateQuantity(line.key, -1)} aria-label="Remover um"><Minus size={14}/></button><span>{line.quantity}</span><button onClick={() => updateQuantity(line.key, 1)} aria-label="Adicionar um"><Plus size={14}/></button></div></div>})}</div><div className="cart-total"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div><button className="button button-primary full" onClick={() => { setCartOpen(false); setCheckout(true); }}>Continuar para pagamento <ChevronDown size={18}/></button></>}</div></div>}

      {checkout && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Finalizar pedido">
          <div className="bottom-sheet checkout-sheet">
            <button type="button" className="sheet-close" onClick={() => setCheckout(false)} aria-label="Fechar"><X size={21}/></button>
            <p className="eyebrow">Finalizar pedido</p>
            <h2>Só faltam seus dados</h2>
            <div className="checkout-summary"><span>{totalItems} itens</span><strong>{formatCurrency(subtotal)}</strong></div>
            {!customer ? <CustomerAccess googleReturnTo="/?checkout=1" onAuthenticated={handleCustomerAuth}/> : <form onSubmit={submitOrder}><div className="checkout-account"><span><UserRound size={18}/></span><div><b>{customer.name}</b><small>{customer.email}{customer.phone ? ` · ${customer.phone}` : " · telefone pendente"}</small></div><button type="button" onClick={() => { setCheckout(false); setAccountOpen(true); }}>Trocar</button></div>
            {!customer.profileComplete && <label className="field complete-phone-field"><span>Telefone para o pedido</span><input required minLength={10} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/><small>Ele será salvo na sua conta após a confirmação.</small></label>}
            <fieldset className="choice-field">
              <legend>Como você recebe?</legend>
              <div className="segmented">
                <button type="button" className={form.deliveryType === "delivery" ? "selected" : ""} onClick={() => setForm({ ...form, deliveryType: "delivery" })}>Entrega</button>
                <button type="button" className={form.deliveryType === "pickup" ? "selected" : ""} onClick={() => setForm({ ...form, deliveryType: "pickup" })}>Retirar no balcão</button>
              </div>
            </fieldset>
            {form.deliveryType === "delivery" && (
              <div className="address-fields">
                <label className="field street"><span>Rua / Avenida</span><input required value={form.street} onChange={(event) => setForm({ ...form, street: event.target.value })}/></label>
                <label className="field number"><span>Número</span><input required value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })}/></label>
                <label className="field"><span>Bairro</span><input required value={form.neighborhood} onChange={(event) => setForm({ ...form, neighborhood: event.target.value })} placeholder="Digite seu bairro"/></label>
                <label className="field"><span>Complemento</span><input value={form.complement} onChange={(event) => setForm({ ...form, complement: event.target.value })}/></label>
                <label className="field full-width"><span>Ponto de referência</span><input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })}/></label>
                <p className="delivery-fee-hint">Taxa padrão de {formatCurrency(catalog.defaultDeliveryFeeCents)}. Bairros com valor diferenciado são calculados automaticamente.</p>
              </div>
            )}
            <fieldset className="choice-field">
              <legend>Forma de pagamento</legend>
              <label className={`payment-option ${form.paymentMethod === "cash" ? "selected" : ""}`}><input type="radio" checked={form.paymentMethod === "cash"} onChange={() => setForm({ ...form, paymentMethod: "cash" })}/><span><b>Dinheiro</b><small>Você paga na entrega/retirada</small></span><span className="payment-symbol">$</span></label>
              <label className={`payment-option ${form.paymentMethod === "card" ? "selected" : ""}`}><input type="radio" checked={form.paymentMethod === "card"} onChange={() => setForm({ ...form, paymentMethod: "card" })}/><span><b>Cartão na entrega</b><small>Informe a maquininha ao receber</small></span><CreditCard size={21}/></label>
              <label className={`payment-option disabled ${form.paymentMethod === "pix" ? "selected" : ""}`}><input type="radio" disabled={!catalog.pixConfigured} checked={form.paymentMethod === "pix"} onChange={() => setForm({ ...form, paymentMethod: "pix" })}/><span><b>Pix</b><small>{catalog.pixConfigured ? "QR Code após confirmar" : "Aguardando configuração"}</small></span><span className="pix-mark">PIX</span></label>
            </fieldset>
            {formError && <p className="form-error">{formError}</p>}
            <button className="button button-primary full" disabled={isSubmitting}>{isSubmitting ? "Enviando pedido…" : <>Enviar pedido <span>{formatCurrency(subtotal)}</span></>}</button>
            <p className="privacy-note">Ao enviar, você aceita os <Link href="/termos-de-uso">Termos de uso</Link> e a <Link href="/politica-de-privacidade">Política de privacidade</Link>.</p>
            </form>}
          </div>
        </div>
      )}
    </main>
  );
}
