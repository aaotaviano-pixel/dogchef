"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BellRing, Check, ChefHat, Clock3, LogOut, PackageCheck, ReceiptText, X } from "lucide-react";

import { CustomerAccess } from "@/components/customer-access";
import { formatCurrency } from "@/lib/money";
import type { CustomerAccount, Order } from "@/lib/types";

const statusLabels: Record<Order["status"], string> = {
  pending_approval: "Aguardando confirmação",
  confirmed: "Confirmado",
  preparing: "Em preparo",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export function CustomerOrders() {
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const statuses = useRef(new Map<string, Order["status"]>());
  const hasLoadedOrders = useRef(false);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const sessionResponse = await fetch("/api/v1/customer/session", { cache: "no-store" });
      const session = await sessionResponse.json();
      if (!session.customer) {
        setCustomer(null);
        setOrders([]);
        statuses.current.clear();
        hasLoadedOrders.current = false;
        return;
      }
      setCustomer(session.customer);
      const ordersResponse = await fetch("/api/v1/customer/orders", { cache: "no-store" });
      const data = await ordersResponse.json();
      if (!ordersResponse.ok) throw new Error(data.error || "Não foi possível carregar seus pedidos.");
      const incoming = data.orders as Order[];
      if (hasLoadedOrders.current) {
        const changed = incoming.find((order) => statuses.current.get(order.id) && statuses.current.get(order.id) !== order.status);
        if (changed) {
          const message = `Pedido ${changed.publicCode}: ${statusLabels[changed.status]}.`;
          setNotice(message);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Dog do Chef", { body: message, icon: "/icon.svg", tag: `pedido-${changed.id}` });
          }
        }
      }
      statuses.current = new Map(incoming.map((order) => [order.id, order.status]));
      hasLoadedOrders.current = true;
      setOrders(incoming);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar seus pedidos.");
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      const supported = typeof Notification !== "undefined";
      setNotificationsSupported(supported);
      setAlertsEnabled(supported && Notification.permission === "granted");
      void load(true);
    }, 0);
    const poll = window.setInterval(() => void load(false), 8_000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(poll); };
  }, [load]);

  async function enableAlerts() {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setAlertsEnabled(permission === "granted");
    setNotice(permission === "granted" ? "Avisos ativados neste aparelho." : "Os avisos do navegador não foram autorizados.");
  }

  async function savePhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPhone(true);
    setError("");
    try {
      const response = await fetch("/api/v1/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.details?.[0] || data.error || "Não foi possível salvar seu telefone.");
      setCustomer(data.customer);
      setNotice("Telefone salvo. Sua conta está pronta para pedidos.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar seu telefone.");
    } finally {
      setSavingPhone(false);
    }
  }

  async function logout() {
    await fetch("/api/v1/customer/logout", { method: "POST" });
    setCustomer(null);
    setOrders([]);
  }

  return <main className="account-shell">
    <header className="account-header"><Link href="/" className="brand-lockup"><span className="brand-mark"><ChefHat size={22}/></span><span><strong>Dog do Chef</strong><small>área do cliente</small></span></Link><Link href="/" className="text-link"><ArrowLeft size={17}/>Cardápio</Link></header>
    <section className="account-content">
      <div className="account-title"><p className="eyebrow">Sua conta</p><h1>Meus pedidos</h1><p>Acompanhe pedidos atuais e consulte seu histórico.</p></div>
      {notice && <p className="customer-notice"><Check size={17}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={15}/></button></p>}
      {loading ? <div className="account-empty"><Clock3 size={28}/><p>Carregando sua conta...</p></div> : !customer ? <CustomerAccess onAuthenticated={() => void load(true)}/> : <>
        <div className="account-welcome"><div><b>Olá, {customer.name.split(" ")[0]}</b><small>{customer.email}</small></div><div className="account-welcome-actions">{notificationsSupported && !alertsEnabled && <button onClick={() => void enableAlerts()}><BellRing size={16}/>Ativar avisos</button>}<button onClick={logout}><LogOut size={16}/>Sair</button></div></div>
        {!customer.profileComplete && <form className="complete-profile" onSubmit={savePhone}><div><b>Complete seu cadastro</b><small>Precisamos do telefone somente para identificar e entregar seu pedido.</small></div><label className="field"><span>Telefone</span><input required minLength={10} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" value={phone} onChange={(event) => setPhone(event.target.value)}/></label><button className="button button-primary" disabled={savingPhone}>{savingPhone ? "Salvando..." : "Salvar telefone"}</button></form>}
        {error && <p className="form-error">{error}</p>}
        {orders.length ? <div className="customer-order-list">{orders.map((order) => <Link href={`/pedido/${order.publicCode}`} key={order.id} className="customer-order-card"><div className="customer-order-card-head"><span><ReceiptText size={17}/><b>{order.publicCode}</b></span><em className={`order-status-badge status-${order.status}`}>{statusLabels[order.status]}</em></div><div className="customer-order-card-body"><span><small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(order.createdAt))}</small><b>{order.quote.items.map((item) => `${item.quantity}× ${item.productName}`).join(" · ")}</b></span><strong>{formatCurrency(order.quote.totalCents)}</strong></div></Link>)}</div> : <div className="account-empty"><PackageCheck size={32}/><h2>Nenhum pedido ainda</h2><p>Quando você finalizar uma compra, ela aparecerá aqui.</p><Link className="button button-primary" href="/">Ver cardápio</Link></div>}
      </>}
    </section>
  </main>;
}
