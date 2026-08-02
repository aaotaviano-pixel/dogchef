"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Camera, ChefHat, ChevronDown, ChevronLeft, ChevronRight, Clock3, CreditCard, LogOut, MapPin, MessageCircle, Minus, Plus, ReceiptText, ShoppingBag, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { formatCurrency } from "@/lib/money";
import { CustomerAccess } from "@/components/customer-access";
import type { CartLine, Catalog, CheckoutInput, CustomerAccount, Product } from "@/lib/types";

const emptyCatalog: Catalog = {
  categories: [], products: [], deliveryZones: [], defaultDeliveryFeeCents: 800, acceptingOrders: false, pixConfigured: false, whatsappConfigured: false, hoursLabel: "Carregando…", workingHours: [],
};

function linePrice(line: CartLine, catalog: Catalog) {
  const product = catalog.products.find((item) => item.id === line.productId);
  if (!product) return 0;
  const choices = product.optionGroups.flatMap((group) => group.options).filter((option) => line.optionIds.includes(option.id));
  return (product.priceCents + choices.reduce((sum, choice) => sum + choice.priceCents, 0)) * line.quantity;
}

function defaultOptions(product: Product) {
  return product.optionGroups.flatMap((group) => group.options.filter((option) => option.isAvailable).slice(0, group.minSelections).map((option) => option.id));
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
  const [form, setForm] = useState({
    name: "", phone: "", email: "", deliveryType: "delivery" as "delivery" | "pickup", paymentMethod: "cash" as "pix" | "cash" | "card",
    street: "", number: "", neighborhood: "", complement: "", reference: "",
  });
  const [heroIndex, setHeroIndex] = useState(0);
  const showcaseProducts = useMemo(() => {
    const featured = catalog.products
      .filter((product) => product.featured && product.isAvailable)
      .sort((left, right) => left.showcaseOrder - right.showcaseOrder)
      .slice(0, 5);
    return featured.length ? featured : catalog.products.filter((product) => product.isAvailable).slice(0, 1);
  }, [catalog.products]);
  const heroProduct = showcaseProducts.length ? showcaseProducts[heroIndex % showcaseProducts.length] : null;
  const featuredProducts = showcaseProducts.slice(0, 3);

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
    if (showcaseProducts.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setHeroIndex((current) => (current + 1) % showcaseProducts.length), 5_200);
    return () => window.clearInterval(timer);
  }, [showcaseProducts.length]);

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
    <main className="store-shell dogchef-store">
      <header className="store-header">
        <div className="brand-lockup"><span className="brand-mark"><ChefHat size={23}/></span><span><strong>Dog do Chef</strong><small>prensado feito na hora</small></span></div>
        <div className="store-header-actions"><a className="icon-button" href="https://www.instagram.com/dogdochef_prensado/" target="_blank" rel="noreferrer" aria-label="Instagram da Dog do Chef" title="Instagram"><Camera size={19}/></a><button className="icon-button" aria-label={customer ? "Abrir minha conta" : "Entrar na minha conta"} onClick={() => setAccountOpen(true)}><UserRound size={19}/></button><button className="icon-button" aria-label="Abrir carrinho" onClick={() => setCartOpen(true)}><ShoppingBag size={20}/>{totalItems > 0 && <b className="cart-count">{totalItems}</b>}</button></div>
      </header>

      <section className="hero dogchef-hero menu-reveal menu-reveal--title" aria-roledescription="carrossel" aria-label="Destaques do cardápio">
        <div className="showcase-slides" aria-live="off">
          {showcaseProducts.length ? showcaseProducts.map((product, index) => <Image key={product.id} className={index === heroIndex % showcaseProducts.length ? "showcase-slide is-active" : "showcase-slide"} src={product.imageUrl} alt="" fill priority={index === 0} loading={index === 0 ? "eager" : "lazy"} sizes="(max-width: 840px) 100vw, 1120px" aria-hidden="true"/>) : <Image className="showcase-slide is-active" src="/images/dogchef/hero-dog-do-chef.webp" alt="" fill priority loading="eager" sizes="(max-width: 840px) 100vw, 1120px" aria-hidden="true"/>}
        </div>
        <span className="showcase-shade" aria-hidden="true"/>
        <div className="hero-content">
          <p className="eyebrow"><span className="dot"/> {catalog.acceptingOrders ? "Pedidos abertos" : "Loja pausada"}</p>
          <p className="showcase-kicker">Destaque da casa</p>
          <h1>{heroProduct?.name ?? "Prensado de verdade"}</h1>
          <p>{heroProduct?.description || "Hot dogs, gratinados, porções e bebidas preparados na hora para você."}</p>
          <div className="showcase-actions"><button className="button button-primary" disabled={!heroProduct} onClick={() => heroProduct && openProduct(heroProduct)}>Pedir agora <Plus size={17}/></button>{heroProduct && <strong>{formatCurrency(heroProduct.priceCents)}</strong>}</div>
          <div className="hero-meta"><span><Clock3 size={16}/>{catalog.hoursLabel}</span><span><MapPin size={16}/>Entrega padrão {formatCurrency(catalog.defaultDeliveryFeeCents)}</span></div>
        </div>
        {showcaseProducts.length > 1 && <div className="showcase-controls"><button onClick={() => setHeroIndex((current) => (current - 1 + showcaseProducts.length) % showcaseProducts.length)} aria-label="Destaque anterior"><ChevronLeft size={19}/></button><div role="tablist" aria-label="Escolher destaque">{showcaseProducts.map((product, index) => <button key={product.id} className={index === heroIndex % showcaseProducts.length ? "showcase-dot is-active" : "showcase-dot"} onClick={() => setHeroIndex(index)} aria-label={`Ver ${product.name}`} aria-selected={index === heroIndex % showcaseProducts.length} role="tab"/>)}</div><button onClick={() => setHeroIndex((current) => (current + 1) % showcaseProducts.length)} aria-label="Próximo destaque"><ChevronRight size={19}/></button></div>}
      </section>

      {featuredProducts.length > 0 && <section className="featured-section menu-reveal menu-reveal--title" aria-labelledby="featured-title">
        <header className="section-heading"><div><p className="eyebrow">Preferidos da casa</p><h2 id="featured-title">Destaques para pedir agora</h2></div></header>
        <div className="featured-grid">{featuredProducts.map((product, index) => <article key={product.id} className={index === 0 ? "featured-card featured-card-main" : "featured-card featured-card-compact"}>
          <button className="featured-card-media" onClick={() => openProduct(product)} aria-label={`Ver ${product.name}`}><Image src={product.imageUrl} alt={product.name} fill sizes={index === 0 ? "(max-width: 719px) 58vw, 520px" : "(max-width: 719px) 38vw, 260px"}/></button>
          <div><small>{product.highlight || "Destaque"}</small><h3>{product.name}</h3>{index === 0 && <p>{product.description}</p>}<footer><strong>{formatCurrency(product.priceCents)}</strong><button className="round-add" onClick={() => openProduct(product)} aria-label={`Adicionar ${product.name}`}><Plus size={17}/></button></footer></div>
        </article>)}</div>
      </section>}

      <section className="menu-section dogchef-menu">
        <div className="section-heading menu-reveal menu-reveal--title"><div><p className="eyebrow">Nosso cardápio</p><h2>Escolha seu favorito</h2></div><span>{catalog.products.filter((product) => product.isAvailable).length} opções</span></div>
        <nav className="category-scroller category-carousel" aria-label="Categorias">
          <button className={activeCategory === "all" ? "category-tile active" : "category-tile"} onClick={() => setActiveCategory("all")}><span className="category-tile-icon"><ChefHat size={24}/></span><b>Todos</b><small>{catalog.products.length} itens</small></button>
          {catalog.categories.map((category) => { const categoryProducts = catalog.products.filter((product) => product.categoryId === category.id); const cover = categoryProducts.find((product) => product.isAvailable)?.imageUrl; return <button key={category.id} className={activeCategory === category.id ? "category-tile active" : "category-tile"} onClick={() => setActiveCategory(category.id)}>{cover ? <span className="category-tile-image"><Image src={cover} alt="" fill sizes="86px"/></span> : <span className="category-tile-icon"><ChefHat size={24}/></span>}<b>{category.name}</b><small>{categoryProducts.length} itens</small></button>; })}
        </nav>
        {visibleCategories.map((category) => {
          const categoryProducts = catalog.products.filter((product) => product.categoryId === category.id);
          return <section key={category.id} className="dogchef-menu-section" aria-labelledby={`category-${category.id}`}>
            <header className="dogchef-menu-section__header menu-reveal menu-reveal--title"><div><p className="eyebrow">{category.description}</p><h3 id={`category-${category.id}`}>{category.name}</h3></div><span>{categoryProducts.filter((product) => product.isAvailable).length} itens</span></header>
            <div className="product-grid">
              {categoryProducts.map((product) => <article key={product.id} className={`product-card menu-reveal ${!product.isAvailable ? "unavailable" : ""}`}>
                <div className="product-image"><Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 619px) 100vw, (max-width: 919px) 50vw, 33vw"/>{product.featured && <span className="pill">{product.highlight ?? "Destaque"}</span>}</div>
                <div className="product-copy"><h3>{product.name}</h3>{product.description && <p>{product.description}</p>}</div>
                <div className="product-bottom"><strong>{formatCurrency(product.priceCents)}</strong><button className="round-add" disabled={!product.isAvailable} onClick={() => openProduct(product)} aria-label={`Adicionar ${product.name}`}><Plus size={19}/></button></div>
                {!product.isAvailable && <span className="sold-out">indisponível agora</span>}
              </article>)}
            </div>
          </section>;
        })}
      </section>

      <footer className="store-footer"><div className="brand-lockup"><span className="brand-mark"><ChefHat size={20}/></span><span><strong>Dog do Chef</strong><small>prensado feito na hora</small></span></div><a href="https://www.instagram.com/dogdochef_prensado/" target="_blank" rel="noreferrer"><Camera size={17}/>@dogdochef_prensado</a><nav className="store-footer-links" aria-label="Informações da loja"><Link href="/politica-de-privacidade">Privacidade</Link><Link href="/termos-de-uso">Termos de uso</Link><Link className="admin-footer-link" href="/admin/login">Acesso administrativo</Link></nav></footer>

      {totalItems > 0 && <button className="floating-cart" onClick={() => setCartOpen(true)}><span><ShoppingBag size={19}/>{totalItems} {totalItems === 1 ? "item" : "itens"}</span><strong>{formatCurrency(subtotal)}</strong></button>}
      {catalog.whatsappUrl && <a className={totalItems > 0 ? "whatsapp-support with-cart" : "whatsapp-support"} href={catalog.whatsappUrl} target="_blank" rel="noreferrer" aria-label="Falar com a loja pelo WhatsApp"><MessageCircle size={19}/><span>Atendimento</span></a>}

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
