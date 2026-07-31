"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, ChefHat, CircleAlert, ClipboardList, LogOut, Package, PauseCircle, PlayCircle, Printer, RefreshCw, Truck, UtensilsCrossed, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { formatCurrency } from "@/lib/money";
import type { Catalog, Order, OrderStatus } from "@/lib/types";

type DashboardPayload = { orders: Order[]; catalog: Catalog; databaseConfigured: boolean; adminConfigured: boolean; integrations: { pix: string; whatsapp: string } };

const labels: Record<OrderStatus, string> = { pending_approval: "Novos", confirmed: "Confirmados", preparing: "Em preparo", out_for_delivery: "Entrega", delivered: "Concluídos", cancelled: "Cancelados" };
const nextActions: Partial<Record<OrderStatus, { status: OrderStatus; label: string; icon: typeof Check }[]>> = {
  pending_approval: [{ status: "confirmed", label: "Aceitar", icon: Check }, { status: "cancelled", label: "Recusar", icon: X }],
  confirmed: [{ status: "preparing", label: "Começar preparo", icon: ChefHat }, { status: "cancelled", label: "Cancelar", icon: X }],
  preparing: [{ status: "out_for_delivery", label: "Saiu para entrega", icon: Truck }, { status: "delivered", label: "Entregue no balcão", icon: Check }],
  out_for_delivery: [{ status: "delivered", label: "Marcar entregue", icon: Check }],
};

function cardClass(status: OrderStatus) { return status.replaceAll("_", "-"); }

export function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const knownNewOrders = useRef(new Set<string>());
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/admin/dashboard", { cache: "no-store" });
      if (response.status === 401) { router.replace("/admin/login"); return; }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o painel.");
      const freshPending = payload.orders.filter((order: Order) => order.status === "pending_approval" && !knownNewOrders.current.has(order.id));
      if (hasLoaded.current && freshPending.length && typeof AudioContext !== "undefined") {
        const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain();
        oscillator.frequency.value = 880; gain.gain.value = 0.06; oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.18);
      }
      payload.orders.forEach((order: Order) => knownNewOrders.current.add(order.id));
      hasLoaded.current = true;
      setData(payload); setError("");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o painel."); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(load, 8_000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [load]);

  async function updateStatus(order: Order, status: OrderStatus) {
    setBusyId(order.id);
    try {
      const response = await fetch(`/api/v1/admin/orders/${order.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, expectedVersion: order.version }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o pedido.");
      await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível atualizar o pedido."); }
    finally { setBusyId(""); }
  }

  async function toggleProduct(id: string, isAvailable: boolean) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/v1/admin/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isAvailable }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o produto.");
      await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível atualizar o produto."); }
    finally { setBusyId(""); }
  }

  async function logout() { await fetch("/api/v1/admin/logout", { method: "POST" }); router.replace("/admin/login"); }

  if (loading && !data) return <main className="admin-shell"><div className="admin-loading"><span className="brand-mark">D</span><p>Abrindo a cozinha…</p></div></main>;
  if (!data) return <main className="admin-shell"><div className="admin-loading"><CircleAlert size={32}/><p>{error || "Não foi possível abrir o painel."}</p><button className="button button-primary" onClick={() => void load()}>Tentar novamente</button></div></main>;

  const operational = data.orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const pending = data.orders.filter((order) => order.status === "pending_approval");
  const revenue = data.orders.filter((order) => order.status === "delivered").reduce((sum, order) => sum + order.quote.totalCents, 0);

  return <main className="admin-shell"><aside className="admin-sidebar"><div className="brand-lockup"><span className="brand-mark">D</span><span><strong>DogChef</strong><small>central da cozinha</small></span></div><nav><a href="#orders"><ClipboardList size={18}/>Pedidos <b>{pending.length}</b></a><a href="#menu"><UtensilsCrossed size={18}/>Cardápio</a><a href="#print"><Printer size={18}/>Impressão</a></nav><div className="admin-sidebar-footer"><p><span className="dot"/>Operação online</p><button onClick={logout}><LogOut size={17}/>Sair</button></div></aside><section className="admin-content"><header className="admin-topbar"><div><p className="eyebrow">Central de operação</p><h1>Boa noite, Chef.</h1></div><div className="topbar-actions"><button className="icon-button" onClick={() => void load()} aria-label="Atualizar pedidos"><RefreshCw size={18}/></button><button className="icon-button notification"><BellRing size={19}/>{pending.length > 0 && <b className="cart-count">{pending.length}</b>}</button></div></header>{error && <p className="admin-error"><CircleAlert size={17}/>{error}<button onClick={() => setError("")} aria-label="Fechar aviso"><X size={15}/></button></p>}{!data.databaseConfigured && <p className="config-banner"><CircleAlert size={18}/><span><b>Modo demonstração ativo.</b> Configure o projeto Supabase e as variáveis de ambiente antes de operar em produção.</span></p>}<div className="metrics"><article><span>Pedidos em andamento</span><strong>{operational.length}</strong><small><span className="dot"/> {pending.length} aguardando ação</small></article><article><span>Faturamento concluído</span><strong>{formatCurrency(revenue)}</strong><small>pedidos entregues</small></article><article><span>Tempo médio estimado</span><strong>25 min</strong><small>atualizado pela cozinha</small></article></div><section id="orders" className="admin-section"><div className="section-heading"><div><p className="eyebrow">Fila de produção</p><h2>Pedidos que precisam de atenção</h2></div><span className="live-label"><span className="dot"/>atualiza a cada 8 s</span></div>{operational.length === 0 ? <div className="kitchen-empty"><Package size={34}/><h3>Fila limpa por enquanto.</h3><p>Novos pedidos vão aparecer aqui e emitir um alerta sonoro.</p></div> : <div className="order-grid">{operational.map((order) => <article key={order.id} className={`kitchen-order ${cardClass(order.status)}`}><header><span className="order-code">{order.publicCode}</span><span className="status-chip">{labels[order.status]}</span></header><div className="order-customer"><b>{order.customer.name}</b><small>{order.deliveryType === "delivery" ? `Entrega · ${order.customer.address?.neighborhood || "endereço pendente"}` : "Retirada no balcão"}</small></div><ul>{order.quote.items.map((item, index) => <li key={`${item.productId}-${index}`}><b>{item.quantity}×</b><span>{item.productName}{item.optionals.length > 0 && <small>{item.optionals.map((option) => option.name).join(", ")}</small>}{item.note && <small>Obs.: {item.note}</small>}</span></li>)}</ul><footer><strong>{formatCurrency(order.quote.totalCents)}</strong><small>{order.paymentMethod === "pix" ? `Pix · ${order.paymentStatus}` : order.paymentMethod === "cash" ? "Dinheiro" : "Cartão"}</small></footer><div className="order-actions">{nextActions[order.status]?.map((action) => { const Icon = action.icon; return <button key={action.status} disabled={busyId === order.id} className={action.status === "cancelled" ? "secondary-danger" : "button button-dark"} onClick={() => void updateStatus(order, action.status)}><Icon size={16}/>{action.label}</button>; })}</div></article>)}</div>}</section><section id="menu" className="admin-section menu-management"><div className="section-heading"><div><p className="eyebrow">Cardápio e horários</p><h2>Controle rápido da loja</h2></div><span className="hours-status"><ClockIcon/> {data.catalog.hoursLabel}</span></div><div className="admin-settings"><article><div><b>Recebimento de pedidos</b><small>A loja valida o horário cadastrado no checkout.</small></div><span className="setting-ready"><Check size={16}/>Horário ativo</span></article><article><div><b>Entregas por bairro</b><small>{data.catalog.deliveryZones.length} zonas ativas de frete fixo enquanto o Maps aguarda chave.</small></div><span className="setting-ready"><Check size={16}/>Fallback ativo</span></article></div><div className="product-switches">{data.catalog.products.map((product) => <article key={product.id}><span className="food-emoji mini">{product.emoji}</span><div><b>{product.name}</b><small>{product.isAvailable ? "visível no cardápio" : "pausado no cardápio"}</small></div><button className={product.isAvailable ? "availability on" : "availability"} disabled={busyId === product.id} onClick={() => void toggleProduct(product.id, !product.isAvailable)} aria-label={product.isAvailable ? `Pausar ${product.name}` : `Ativar ${product.name}`}><span/></button></article>)}</div></section><section id="print" className="admin-section print-section"><div className="section-heading"><div><p className="eyebrow">Impressão térmica</p><h2>Agente local</h2></div><span className="integration-chip"><Printer size={15}/>aguardando instalação</span></div><div className="print-card"><Printer size={26}/><div><b>Conecte a impressora da cozinha</b><p>O agente DogChef consulta com segurança a fila de impressão e envia tickets ESC/POS por rede ou compartilhamento USB.</p></div><code>npm run print-agent</code></div></section></section></main>;
}

function ClockIcon() { return <span aria-hidden="true">◷</span>; }
