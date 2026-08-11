"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BellRing,
  Check,
  ChefHat,
  CircleAlert,
  ClipboardList,
  Clock3,
  ExternalLink,
  GalleryHorizontal,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Pencil,
  Plus,
  Power,
  Printer,
  RefreshCw,
  Save,
  Search,
  Settings,
  Star,
  Trash2,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { AdminProductEditor } from "@/components/admin-product-editor";
import { formatCurrency } from "@/lib/money";
import type { Catalog, Order, OrderStatus, PrintSettings, Product, WorkingHour } from "@/lib/types";

type DashboardPayload = {
  orders: Order[];
  catalog: Catalog;
  databaseConfigured: boolean;
  adminConfigured: boolean;
  integrations: { pix: string; siteNotifications: string };
  print: PrintSettings;
};

type AdminPanel = "dashboard" | "orders" | "products" | "showcase" | "settings" | "print";
type ProductFilter = "all" | "active" | "paused" | "featured";

const labels: Record<OrderStatus, string> = {
  pending_approval: "Novos",
  confirmed: "Confirmados",
  preparing: "Em preparo",
  out_for_delivery: "Entrega",
  delivered: "Concluídos",
  cancelled: "Cancelados",
};

const panelCopy: Record<AdminPanel, { title: string; subtitle: string }> = {
  dashboard: { title: "Visão geral", subtitle: "O que precisa de atenção hoje" },
  orders: { title: "Pedidos", subtitle: "Acompanhe a fila da cozinha" },
  products: { title: "Produtos", subtitle: "Cadastre e organize o cardápio" },
  showcase: { title: "Showcase", subtitle: "Escolha o banner da página inicial" },
  settings: { title: "Configurações", subtitle: "Loja, horários e entrega" },
  print: { title: "Impressão", subtitle: "Acompanhe a impressora térmica" },
};

const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const printLabels = {
  queued: "Na fila",
  leased: "Imprimindo",
  printed: "Impresso",
  failed: "Nova tentativa",
  dead: "Falha na impressão",
} as const;

const nextActions: Partial<Record<OrderStatus, { status: OrderStatus; label: string; icon: typeof Check }[]>> = {
  pending_approval: [
    { status: "confirmed", label: "Aceitar", icon: Check },
    { status: "cancelled", label: "Recusar", icon: X },
  ],
  confirmed: [
    { status: "preparing", label: "Começar preparo", icon: ChefHat },
    { status: "cancelled", label: "Cancelar", icon: X },
  ],
  preparing: [
    { status: "out_for_delivery", label: "Saiu para entrega", icon: Truck },
    { status: "delivered", label: "Entregue no balcão", icon: Check },
  ],
  out_for_delivery: [{ status: "delivered", label: "Marcar entregue", icon: Check }],
};

function feeInput(cents: number) {
  return (cents / 100).toFixed(2);
}

function feeCents(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function cardClass(status: OrderStatus) {
  return status.replaceAll("_", "-");
}

export function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [activePanel, setActivePanel] = useState<AdminPanel>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [hoursDraft, setHoursDraft] = useState<WorkingHour[] | null>(null);
  const [defaultFeeDraft, setDefaultFeeDraft] = useState<string | null>(null);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneFee, setNewZoneFee] = useState("");
  const [zoneDrafts, setZoneDrafts] = useState<Record<string, { name: string; fee: string }>>({});
  const [currentAdminPassword, setCurrentAdminPassword] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [adminPasswordConfirmation, setAdminPasswordConfirmation] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const knownNewOrders = useRef(new Set<string>());
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/admin/dashboard", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const payload = await response.json() as DashboardPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o painel.");
      const savedPrinterId = window.localStorage.getItem("dogchef-printer-id");
      if (savedPrinterId && payload.print.printers.some((printer) => printer.id === savedPrinterId)) payload.print.selectedPrinterId = savedPrinterId;
      const freshPending = payload.orders.filter((order) => order.status === "pending_approval" && !knownNewOrders.current.has(order.id));
      if (hasLoaded.current && freshPending.length) {
        setNotice(freshPending.length === 1 ? `Novo pedido ${freshPending[0].publicCode} recebido.` : `${freshPending.length} novos pedidos recebidos.`);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Novo pedido no Dog do Chef", {
            body: freshPending.length === 1 ? `${freshPending[0].publicCode} · ${freshPending[0].customer.name}` : `${freshPending.length} pedidos aguardam confirmação.`,
            icon: "/icon.png",
            tag: "dogchef-novos-pedidos",
          });
        }
        if (typeof AudioContext !== "undefined") {
          const context = new AudioContext();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = 880;
          gain.gain.value = 0.06;
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.18);
        }
      }
      payload.orders.forEach((order) => knownNewOrders.current.add(order.id));
      hasLoaded.current = true;
      setData(payload);
      setEditingProduct((current) => current ? payload.catalog.products.find((product) => product.id === current.id) ?? null : null);
      setHoursDraft((current) => current ?? payload.catalog.workingHours);
      setDefaultFeeDraft((current) => current ?? feeInput(payload.catalog.defaultDeliveryFeeCents));
      setZoneDrafts((current) => Object.fromEntries(payload.catalog.deliveryZones.map((zone) => [
        zone.id,
        current[zone.id] ?? { name: zone.name, fee: feeInput(zone.feeCents) },
      ])));
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      setAlertsEnabled(typeof Notification !== "undefined" && Notification.permission === "granted");
      void load();
    }, 0);
    const timer = window.setInterval(load, 8_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [load]);

  async function openNotifications() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setAlertsEnabled(permission === "granted");
      if (permission === "granted") setNotice("Avisos de novos pedidos ativados neste aparelho.");
    }
    openPanel("orders");
  }

  function openPanel(panel: AdminPanel) {
    setActivePanel(panel);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openNewProduct() {
    setEditingProduct(null);
    setEditorOpen(true);
  }

  function openProduct(product: Product) {
    setEditingProduct(product);
    setEditorOpen(true);
  }

  async function productSaved(message: string) {
    setNotice(message);
    await load();
  }

  async function updateStatus(order: Order, status: OrderStatus) {
    setBusyId(order.id);
    try {
      const response = await fetch(`/api/v1/admin/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, expectedVersion: order.version, printerId: status === "confirmed" ? data?.print.selectedPrinterId : undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o pedido.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível atualizar o pedido.");
    } finally {
      setBusyId("");
    }
  }

  async function updateProductSetting(id: string, update: { isAvailable?: boolean; featured?: boolean }) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/v1/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o produto.");
      setNotice("Produto atualizado.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível atualizar o produto.");
    } finally {
      setBusyId("");
    }
  }

  async function saveShowcase(productIds: string[]) {
    setBusyId("showcase");
    try {
      const response = await fetch("/api/v1/admin/showcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar o showcase.");
      setNotice("Showcase atualizado. A alteração já aparece na loja.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar o showcase.");
    } finally {
      setBusyId("");
    }
  }

  async function updateAcceptingOrders(acceptingOrders: boolean) {
    setBusyId("store-settings");
    try {
      const response = await fetch("/api/v1/admin/settings/accepting-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptingOrders }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar a loja.");
      setNotice(acceptingOrders ? "A loja voltou a receber pedidos." : "A loja foi pausada temporariamente.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível atualizar a loja.");
    } finally {
      setBusyId("");
    }
  }

  async function updateAdminPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newAdminPassword !== adminPasswordConfirmation) {
      setError("A confirmação da nova senha não confere.");
      return;
    }
    setBusyId("admin-password");
    try {
      const response = await fetch("/api/v1/admin/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentAdminPassword, newPassword: newAdminPassword, confirmation: adminPasswordConfirmation }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar a senha administrativa.");
      setCurrentAdminPassword("");
      setNewAdminPassword("");
      setAdminPasswordConfirmation("");
      setNotice("Senha administrativa atualizada.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível atualizar a senha administrativa.");
    } finally {
      setBusyId("");
    }
  }

  function updateHour(index: number, update: Partial<WorkingHour>) {
    setHoursDraft((current) => current?.map((hour, hourIndex) => hourIndex === index ? { ...hour, ...update } : hour) ?? null);
  }

  async function saveWorkingHours() {
    if (!hoursDraft) return;
    setBusyId("working-hours");
    try {
      const response = await fetch("/api/v1/admin/working-hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingHours: hoursDraft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar os horários.");
      setHoursDraft(result.workingHours);
      setNotice("Horários atualizados com sucesso.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar os horários.");
    } finally {
      setBusyId("");
    }
  }

  async function reprintOrder(order: Order) {
    setBusyId(`print-${order.id}`);
    try {
      const response = await fetch(`/api/v1/admin/orders/${order.id}/print`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ printerId: data?.print.selectedPrinterId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível reenviar para impressão.");
      setNotice(`Pedido ${order.publicCode} enviado para a fila de impressão.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível reenviar para impressão.");
    } finally {
      setBusyId("");
    }
  }

  async function saveSelectedPrinter(selectedPrinterId: string) {
    setBusyId("printer");
    try {
      const response = await fetch("/api/v1/admin/settings/printer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedPrinterId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível selecionar a impressora.");
      window.localStorage.setItem("dogchef-printer-id", selectedPrinterId);
      setNotice("Impressora selecionada para os próximos pedidos.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível selecionar a impressora.");
    } finally {
      setBusyId("");
    }
  }

  async function resetDashboardMetrics() {
    setBusyId("metrics-reset");
    try {
      const response = await fetch("/api/v1/admin/settings/metrics", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível zerar os indicadores.");
      setNotice("Indicadores zerados. Os pedidos anteriores foram preservados no histórico.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível zerar os indicadores.");
    } finally {
      setBusyId("");
    }
  }

  async function testSelectedPrinter() {
    setBusyId("printer-test");
    try {
      const response = await fetch("/api/v1/admin/settings/printer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedPrinterId: data?.print.selectedPrinterId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar o teste para a impressora.");
      setNotice(data?.print.agentConnected ? "Teste enviado para a impressora selecionada." : "Teste colocado na fila. Inicie o agente local para imprimir.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível testar a impressora.");
    } finally {
      setBusyId("");
    }
  }

  async function refreshPrinterState(message = "Lista de impressoras atualizada.") {
    setBusyId("printer-refresh");
    try {
      await load();
      setNotice(message);
    } finally {
      setBusyId("");
    }
  }

  async function saveDefaultDeliveryFee() {
    const cents = defaultFeeDraft === null ? null : feeCents(defaultFeeDraft);
    if (cents === null) return setError("Informe uma taxa padrão válida.");
    setBusyId("default-delivery-fee");
    try {
      const response = await fetch("/api/v1/admin/settings/delivery-fee", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultDeliveryFeeCents: cents }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar a taxa padrão.");
      setDefaultFeeDraft(feeInput(result.defaultDeliveryFeeCents));
      setNotice("Taxa padrão de entrega atualizada.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar a taxa padrão.");
    } finally {
      setBusyId("");
    }
  }

  async function createDeliveryOverride() {
    const cents = feeCents(newZoneFee);
    if (newZoneName.trim().length < 2 || cents === null) return setError("Informe o bairro e uma taxa válida.");
    setBusyId("new-delivery-zone");
    try {
      const response = await fetch("/api/v1/admin/delivery-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newZoneName, feeCents: cents }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar o bairro.");
      setNewZoneName("");
      setNewZoneFee("");
      setNotice("Bairro com taxa diferenciada cadastrado.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível cadastrar o bairro.");
    } finally {
      setBusyId("");
    }
  }

  function updateZoneDraft(id: string, update: Partial<{ name: string; fee: string }>) {
    setZoneDrafts((current) => ({ ...current, [id]: { ...current[id], ...update } }));
  }

  async function saveDeliveryOverride(id: string) {
    const draft = zoneDrafts[id];
    const cents = draft ? feeCents(draft.fee) : null;
    if (!draft || draft.name.trim().length < 2 || cents === null) return setError("Confira o nome do bairro e a taxa.");
    setBusyId(`delivery-${id}`);
    try {
      const response = await fetch(`/api/v1/admin/delivery-zones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, feeCents: cents }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o bairro.");
      setNotice("Taxa diferenciada atualizada.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível atualizar o bairro.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteDeliveryOverride(id: string) {
    setBusyId(`delivery-${id}`);
    try {
      const response = await fetch(`/api/v1/admin/delivery-zones/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir o bairro.");
      setNotice("Bairro removido. A taxa padrão será usada nele.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível excluir o bairro.");
    } finally {
      setBusyId("");
    }
  }

  async function logout() {
    await fetch("/api/v1/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  if (loading && !data) return <main className="admin-shell"><div className="admin-loading"><span className="brand-mark"><ChefHat size={23}/></span><p>Abrindo a cozinha...</p></div></main>;
  if (!data) return <main className="admin-shell"><div className="admin-loading"><CircleAlert size={32}/><p>{error || "Não foi possível abrir o painel."}</p><button className="button button-primary" onClick={() => void load()}>Tentar novamente</button></div></main>;

  const operational = data.orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const pending = data.orders.filter((order) => order.status === "pending_approval");
  const revenue = data.orders.filter((order) => order.status === "delivered").reduce((sum, order) => sum + order.quote.totalCents, 0);
  const featuredProducts = data.catalog.products.filter((product) => product.featured).sort((left, right) => left.showcaseOrder - right.showcaseOrder);
  const featuredIds = featuredProducts.map((product) => product.id);
  const printOrders = data.orders.filter((order) => order.printStatus).slice(0, 8);
  const normalizedSearch = productSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredProducts = data.catalog.products.filter((product) => {
    const matchesSearch = !normalizedSearch || `${product.name} ${product.description}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    const matchesFilter = productFilter === "all" || (productFilter === "active" && product.isAvailable) || (productFilter === "paused" && !product.isAvailable) || (productFilter === "featured" && product.featured);
    return matchesSearch && matchesFilter;
  });

  const navItems: Array<{ id: AdminPanel; label: string; icon: typeof LayoutDashboard }> = [
    { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
    { id: "orders", label: "Pedidos", icon: ClipboardList },
    { id: "products", label: "Produtos", icon: UtensilsCrossed },
    { id: "showcase", label: "Showcase", icon: GalleryHorizontal },
    { id: "settings", label: "Configurações", icon: Settings },
    { id: "print", label: "Impressão", icon: Printer },
  ];

  function renderOrder(order: Order) {
    return <article key={order.id} className={`kitchen-order ${cardClass(order.status)}`}>
      <header><span className="order-code">{order.publicCode}</span><span className="status-chip">{labels[order.status]}</span></header>
      <div className="order-customer"><b>{order.customer.name}</b><small>{order.deliveryType === "delivery" ? `Entrega · ${order.customer.address?.neighborhood || "endereço pendente"}` : "Retirada no balcão"}</small></div>
      <ul>{order.quote.items.map((item, index) => <li key={`${item.productId}-${index}`}><b>{item.quantity}×</b><span>{item.productName}{item.optionals.length > 0 && <small>{item.optionals.map((option) => option.name).join(", ")}</small>}{item.note && <small>Obs.: {item.note}</small>}</span></li>)}</ul>
      <footer><strong>{formatCurrency(order.quote.totalCents)}</strong><small>{order.paymentMethod === "pix" ? `Pix · ${order.paymentStatus}` : order.paymentMethod === "cash" ? "Dinheiro" : "Cartão"}</small></footer>
      <div className="order-actions">{nextActions[order.status]?.filter((action) => order.deliveryType === "delivery" || action.status !== "out_for_delivery").map((action) => { const Icon = action.icon; return <button key={action.status} disabled={busyId === order.id} className={action.status === "cancelled" ? "secondary-danger" : "button button-dark"} onClick={() => void updateStatus(order, action.status)}><Icon size={16}/>{action.label}</button>; })}</div>
    </article>;
  }

  return (
    <main className="admin-shell admin-manager">
      <aside className={sidebarOpen ? "admin-sidebar is-open" : "admin-sidebar"}>
        <div className="brand-lockup"><span className="brand-mark"><ChefHat size={23}/></span><span><strong>Dog do Chef</strong><small>Painel administrativo</small></span></div>
        <nav>{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={activePanel === item.id ? "is-active" : ""} onClick={() => openPanel(item.id)}><Icon size={18}/>{item.label}{item.id === "orders" && pending.length > 0 && <b>{pending.length}</b>}</button>; })}</nav>
        <div className="admin-sidebar-footer"><p><span className={data.catalog.acceptingOrders ? "dot" : "dot paused"}/>{data.catalog.acceptingOrders ? "Recebendo pedidos" : "Loja pausada"}</p><button onClick={() => void logout()}><LogOut size={17}/>Sair</button></div>
      </aside>
      {sidebarOpen && <button className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"/>}

      <section className="admin-content">
        <header className="admin-topbar">
          <div className="admin-title-group"><button className="admin-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><Menu size={21}/></button><div><p className="eyebrow">Central da cozinha</p><h1>{panelCopy[activePanel].title}</h1><small>{panelCopy[activePanel].subtitle}</small></div></div>
          <div className="topbar-actions"><Link className="admin-back-store" href="/"><ExternalLink size={17}/><span>Voltar pro site</span></Link><button className="icon-button" onClick={() => void load()} aria-label="Atualizar painel" title="Atualizar"><RefreshCw size={18}/></button><button className={alertsEnabled ? "icon-button notification alerts-enabled" : "icon-button notification"} onClick={() => void openNotifications()} aria-label={alertsEnabled ? `${pending.length} pedidos novos; avisos ativados` : `${pending.length} pedidos novos; ativar avisos`} title={alertsEnabled ? "Avisos ativados" : "Ativar avisos de pedido"}><BellRing size={19}/>{pending.length > 0 && <b className="cart-count">{pending.length}</b>}</button></div>
        </header>

        {error && <p className="admin-error"><CircleAlert size={17}/>{error}<button onClick={() => setError("")} aria-label="Fechar aviso"><X size={15}/></button></p>}
        {notice && <p className="admin-notice"><Check size={17}/>{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={15}/></button></p>}
        {!data.databaseConfigured && <p className="config-banner"><CircleAlert size={18}/><span><b>Modo demonstração ativo.</b> As alterações ficam nesta máquina. Configure o Supabase antes de publicar.</span></p>}

        {activePanel === "dashboard" && <div className="admin-panel-view">
          <div className="metrics">
            <article><span>Pedidos em andamento</span><strong>{operational.length}</strong><small><span className="dot"/> {pending.length} aguardando confirmação</small></article>
            <article><span>Faturamento concluído</span><strong>{formatCurrency(revenue)}</strong><small>pedidos entregues</small></article>
            <article><span>Produtos ativos</span><strong>{data.catalog.products.filter((product) => product.isAvailable).length}</strong><small>{data.catalog.products.length} cadastrados</small></article>
          </div>
          <section className="dashboard-shortcuts"><div className="section-heading"><div><p className="eyebrow">Acesso rápido</p><h2>O que deseja fazer?</h2></div></div><div className="shortcut-grid">
            <button onClick={openNewProduct}><span><Plus size={22}/></span><b>Novo produto</b><small>Nome, preço e fotos</small></button>
            <button onClick={() => openPanel("orders")}><span><ClipboardList size={22}/></span><b>Ver pedidos</b><small>{pending.length ? `${pending.length} esperando resposta` : "Fila atualizada"}</small></button>
            <button onClick={() => openPanel("showcase")}><span><GalleryHorizontal size={22}/></span><b>Editar showcase</b><small>{featuredProducts.length} de 5 produtos</small></button>
            <button onClick={() => openPanel("settings")}><span><Settings size={22}/></span><b>Configurações</b><small>Horários e entrega</small></button>
          </div></section>
          <div className="dashboard-columns">
            <section className="dashboard-list-panel"><header><div><p className="eyebrow">Agora</p><h2>Pedidos recentes</h2></div><button onClick={() => openPanel("orders")}>Ver todos</button></header>{operational.length ? <div className="dashboard-mini-list">{operational.slice(0, 5).map((order) => <button key={order.id} onClick={() => openPanel("orders")}><span><b>{order.publicCode}</b><small>{order.customer.name}</small></span><em>{labels[order.status]}</em><strong>{formatCurrency(order.quote.totalCents)}</strong></button>)}</div> : <div className="dashboard-empty"><Package size={28}/><span>Nenhum pedido em andamento.</span></div>}</section>
            <section className="dashboard-list-panel"><header><div><p className="eyebrow">Cardápio</p><h2>Produtos pausados</h2></div><button onClick={() => { setProductFilter("paused"); openPanel("products"); }}>Gerenciar</button></header>{data.catalog.products.some((product) => !product.isAvailable) ? <div className="dashboard-mini-list">{data.catalog.products.filter((product) => !product.isAvailable).slice(0, 5).map((product) => <button key={product.id} onClick={() => openProduct(product)}><span><b>{product.name}</b><small>{data.catalog.categories.find((category) => category.id === product.categoryId)?.name}</small></span><em>Pausado</em><strong>{formatCurrency(product.priceCents)}</strong></button>)}</div> : <div className="dashboard-empty"><Check size={28}/><span>Todos os produtos estão ativos.</span></div>}</section>
          </div>
        </div>}

        {activePanel === "orders" && <section className="admin-panel-view admin-section">
          <div className="section-heading"><div><p className="eyebrow">Fila de produção</p><h2>Pedidos que precisam de atenção</h2></div><span className="live-label"><span className="dot"/>atualiza a cada 8 s</span></div>
          {operational.length === 0 ? <div className="kitchen-empty"><Package size={34}/><h3>Fila limpa por enquanto.</h3><p>Novos pedidos aparecerão aqui e emitirão um alerta sonoro.</p></div> : <div className="order-grid">{operational.map(renderOrder)}</div>}
        </section>}

        {activePanel === "products" && <section className="admin-panel-view">
          <div className="admin-toolbar"><label className="admin-search"><Search size={18}/><input type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar produto"/></label><div className="admin-segments">{([['all','Todos'],['active','Ativos'],['paused','Pausados'],['featured','Showcase']] as Array<[ProductFilter,string]>).map(([id,label]) => <button key={id} className={productFilter === id ? "is-active" : ""} onClick={() => setProductFilter(id)}>{label}</button>)}</div><button className="button button-dark" onClick={openNewProduct}><Plus size={16}/>Novo produto</button></div>
          <p className="admin-results-count">{filteredProducts.length} {filteredProducts.length === 1 ? "produto encontrado" : "produtos encontrados"}</p>
          <div className="admin-product-grid">{filteredProducts.map((product) => <article key={product.id} className={!product.isAvailable ? "is-paused" : ""}>
            <div className="admin-product-photo"><Image src={product.imageUrl} alt="" fill sizes="(max-width: 619px) 100vw, (max-width: 1179px) 50vw, 25vw"/>{product.featured && <span><Star size={12} fill="currentColor"/>Showcase</span>}</div>
            <div className="admin-product-card-body"><small>{data.catalog.categories.find((category) => category.id === product.categoryId)?.name}</small><h3>{product.name}</h3><p>{product.description || "Sem descrição cadastrada."}</p><strong>{formatCurrency(product.priceCents)}</strong></div>
            <footer><button className="button button-ghost" onClick={() => openProduct(product)}><Pencil size={15}/>Editar</button><button className={product.isAvailable ? "availability on" : "availability"} disabled={busyId === product.id} onClick={() => void updateProductSetting(product.id, { isAvailable: !product.isAvailable })} aria-label={product.isAvailable ? `Pausar ${product.name}` : `Ativar ${product.name}`} title={product.isAvailable ? "Pausar produto" : "Ativar produto"}><span/></button></footer>
          </article>)}</div>
        </section>}

        {activePanel === "showcase" && <section className="admin-panel-view showcase-manager">
          <div className="showcase-intro"><div><GalleryHorizontal size={24}/><span><b>Banner da página inicial</b><small>Selecione até 5 produtos. A foto principal, nome, descrição e preço formam cada slide.</small></span></div><strong>{featuredProducts.length}/5</strong></div>
          <div className="showcase-layout"><section><div className="section-heading compact"><div><p className="eyebrow">Ordem do banner</p><h2>Slides ativos</h2></div></div>{featuredProducts.length ? <div className="showcase-selected-list">{featuredProducts.map((product, index) => <article key={product.id}>
            <span className="showcase-position">{index + 1}</span><div className="showcase-thumb"><Image src={product.imageUrl} alt="" width={56} height={44}/></div><div><b>{product.name}</b><small>{formatCurrency(product.priceCents)}</small></div><div className="showcase-row-actions"><button disabled={index === 0 || busyId === "showcase"} onClick={() => { const ids = [...featuredIds]; [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; void saveShowcase(ids); }} aria-label="Mover para cima" title="Mover para cima"><ArrowUp size={15}/></button><button disabled={index === featuredProducts.length - 1 || busyId === "showcase"} onClick={() => { const ids = [...featuredIds]; [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]; void saveShowcase(ids); }} aria-label="Mover para baixo" title="Mover para baixo"><ArrowDown size={15}/></button><button className="danger" disabled={busyId === "showcase"} onClick={() => void saveShowcase(featuredIds.filter((id) => id !== product.id))} aria-label="Remover do showcase" title="Remover"><Trash2 size={15}/></button></div>
          </article>)}</div> : <div className="showcase-empty"><GalleryHorizontal size={32}/><b>O showcase está vazio.</b><span>Adicione um produto ativo na lista ao lado.</span></div>}</section>
          <section><div className="section-heading compact"><div><p className="eyebrow">Estoque</p><h2>Adicionar produto</h2></div></div><div className="showcase-picker">{data.catalog.products.filter((product) => product.isAvailable && !product.featured).map((product) => <button key={product.id} disabled={featuredProducts.length >= 5 || busyId === "showcase"} onClick={() => void saveShowcase([...featuredIds, product.id])}><div><Image src={product.imageUrl} alt="" width={52} height={50}/></div><span><b>{product.name}</b><small>{formatCurrency(product.priceCents)}</small></span><Plus size={17}/></button>)}</div></section></div>
        </section>}

        {activePanel === "settings" && <section className="admin-panel-view settings-view">
          <div className="admin-settings">
            <article><div><b>Recebimento de pedidos</b><small>{data.catalog.acceptingOrders ? "Clientes podem finalizar pedidos dentro do horário." : "Novos pedidos estão bloqueados temporariamente."}</small></div><button className={data.catalog.acceptingOrders ? "store-toggle is-open" : "store-toggle"} disabled={busyId === "store-settings"} onClick={() => void updateAcceptingOrders(!data.catalog.acceptingOrders)}><Power size={15}/>{data.catalog.acceptingOrders ? "Pausar loja" : "Abrir loja"}</button></article>
            <article><div><b>Taxa de entrega</b><small>R$ {feeInput(data.catalog.defaultDeliveryFeeCents).replace(".", ",")} por padrão; {data.catalog.deliveryZones.length} {data.catalog.deliveryZones.length === 1 ? "exceção" : "exceções"}.</small></div><span className="setting-ready"><Check size={16}/>Regra ativa</span></article>
          </div>
          <form className="admin-password-editor" onSubmit={(event) => void updateAdminPassword(event)}><div><b>Senha administrativa</b><small>Atualize o acesso do painel sem expor a senha em arquivos.</small></div><div className="admin-password-fields"><label><span>Senha atual</span><input required type="password" autoComplete="current-password" value={currentAdminPassword} onChange={(event) => setCurrentAdminPassword(event.target.value)}/></label><label><span>Nova senha</span><input required minLength={12} type="password" autoComplete="new-password" value={newAdminPassword} onChange={(event) => setNewAdminPassword(event.target.value)}/></label><label><span>Confirmar nova senha</span><input required minLength={12} type="password" autoComplete="new-password" value={adminPasswordConfirmation} onChange={(event) => setAdminPasswordConfirmation(event.target.value)}/></label><button className="button button-dark" type="submit" disabled={busyId === "admin-password"}><Save size={15}/>{busyId === "admin-password" ? "Salvando..." : "Atualizar senha"}</button></div></form>
          {hoursDraft && <div className="hours-editor"><div className="hours-editor-heading"><div><b>Dias e horários</b><small>O checkout bloqueia pedidos fora destes períodos.</small></div><button className="button button-dark" disabled={busyId === "working-hours"} onClick={() => void saveWorkingHours()}><Save size={15}/>{busyId === "working-hours" ? "Salvando..." : "Salvar horários"}</button></div><div className="hours-grid">{hoursDraft.map((hour, index) => <div className="hours-row" key={`${hour.weekday}-${hour.slot}`}><b>{weekdays[hour.weekday]}</b><label className="closed-toggle"><input type="checkbox" checked={hour.isClosed} onChange={(event) => updateHour(index, { isClosed: event.target.checked })}/><span>Fechado</span></label><label><span>Abre</span><input type="time" disabled={hour.isClosed} value={hour.opensAt.slice(0, 5)} onChange={(event) => updateHour(index, { opensAt: event.target.value })}/></label><label><span>Fecha</span><input type="time" disabled={hour.isClosed} value={hour.closesAt.slice(0, 5)} onChange={(event) => updateHour(index, { closesAt: event.target.value })}/></label></div>)}</div></div>}
          <div className="delivery-editor"><div className="delivery-editor-heading"><div><b>Taxa padrão e exceções</b><small>Todo bairro usa a taxa padrão, exceto os cadastrados abaixo.</small></div><MapPin size={20}/></div><div className="default-fee-control"><label><span>Taxa padrão</span><div className="money-input"><span>R$</span><input type="number" min="0" step="0.01" value={defaultFeeDraft ?? ""} onChange={(event) => setDefaultFeeDraft(event.target.value)}/></div></label><button className="button button-dark" disabled={busyId === "default-delivery-fee"} onClick={() => void saveDefaultDeliveryFee()}><Save size={15}/>Salvar taxa</button></div><div className="delivery-override-form"><label><span>Novo bairro com valor diferente</span><input value={newZoneName} maxLength={80} placeholder="Nome do bairro" onChange={(event) => setNewZoneName(event.target.value)}/></label><label><span>Taxa</span><div className="money-input"><span>R$</span><input type="number" min="0" step="0.01" value={newZoneFee} placeholder="0,00" onChange={(event) => setNewZoneFee(event.target.value)}/></div></label><button className="button button-dark" disabled={busyId === "new-delivery-zone"} onClick={() => void createDeliveryOverride()}><Plus size={15}/>Adicionar</button></div>{data.catalog.deliveryZones.length > 0 ? <div className="delivery-overrides">{data.catalog.deliveryZones.map((zone) => <div className="delivery-override-row" key={zone.id}><input aria-label={`Nome do bairro ${zone.name}`} value={zoneDrafts[zone.id]?.name ?? zone.name} onChange={(event) => updateZoneDraft(zone.id, { name: event.target.value })}/><div className="money-input"><span>R$</span><input aria-label={`Taxa do bairro ${zone.name}`} type="number" min="0" step="0.01" value={zoneDrafts[zone.id]?.fee ?? feeInput(zone.feeCents)} onChange={(event) => updateZoneDraft(zone.id, { fee: event.target.value })}/></div><button className="icon-button" disabled={busyId === `delivery-${zone.id}`} onClick={() => void saveDeliveryOverride(zone.id)} aria-label={`Salvar ${zone.name}`} title="Salvar"><Save size={15}/></button><button className="icon-button danger" disabled={busyId === `delivery-${zone.id}`} onClick={() => void deleteDeliveryOverride(zone.id)} aria-label={`Excluir ${zone.name}`} title="Excluir"><Trash2 size={15}/></button></div>)}</div> : <p className="delivery-empty">Nenhuma exceção cadastrada. Todos os bairros usam a taxa padrão.</p>}</div>
          <div className="admin-settings"><article><div><b>Indicadores do painel</b><small>Zere os testes sem apagar pedidos, clientes ou comprovantes do histórico.</small></div><button className="button button-dark" disabled={busyId === "metrics-reset"} onClick={() => void resetDashboardMetrics()}><RefreshCw size={15}/>{busyId === "metrics-reset" ? "Zerando..." : "Zerar indicadores"}</button></article></div>
        </section>}

        {activePanel === "print" && <section className="admin-panel-view admin-section print-section">
          <div className="section-heading"><div><p className="eyebrow">Impressão térmica</p><h2>Escolha onde imprimir</h2></div><span className="integration-chip"><Printer size={15}/>{data.print.agentConnected ? "Windows conectado" : "agente local"}</span></div>
          <div className="print-card"><Printer size={26}/><div><b>Impressora dos próximos pedidos</b><p>{data.print.agentConnected ? `O Windows informou ${data.print.printers.length} impressora${data.print.printers.length === 1 ? " instalada" : "s instaladas"} neste computador.` : "Abra o agente local no computador da cozinha para reconhecer automaticamente as impressoras instaladas no Windows."}</p><label className="print-selector"><span>Imprimir em</span><select value={data.print.selectedPrinterId} disabled={busyId === "printer"} onChange={(event) => void saveSelectedPrinter(event.target.value)}>{data.print.printers.map((printer) => <option key={printer.id} value={printer.id}>{printer.name}{printer.isDefault ? " · padrão" : ""}{printer.status === "offline" ? " · offline" : ""}</option>)}</select></label></div><code>npm run print-agent</code></div>
          <div className="print-actions"><button className="button button-dark" disabled={busyId === "printer-test"} onClick={() => void testSelectedPrinter()}><Printer size={15}/>{busyId === "printer-test" ? "Enviando..." : "Testar impressão"}</button><button className="button button-ghost" disabled={busyId === "printer-refresh"} onClick={() => void refreshPrinterState()}><RefreshCw size={15}/>Atualizar impressoras</button><button className="button button-ghost" disabled={busyId === "printer-refresh"} onClick={() => void refreshPrinterState(data.print.agentConnected ? "Agente local conectado e lista recebida do Windows." : "Agente local não conectado. Abra o serviço na máquina da cozinha.")}><CircleAlert size={15}/>Diagnosticar</button></div>
          {printOrders.length > 0 && <div className="print-jobs">{printOrders.map((order) => <article key={order.id}><div><b>{order.publicCode}</b><small>{order.customer.name}</small></div><span className={`print-status ${order.printStatus}`}>{printLabels[order.printStatus!]}</span><button className="button button-dark" disabled={busyId === `print-${order.id}`} onClick={() => void reprintOrder(order)}><Printer size={14}/>{order.printStatus === "printed" ? "Reimprimir" : "Tentar novamente"}</button></article>)}</div>}
        </section>}
      </section>

      <nav className="admin-mobile-nav" aria-label="Navegação do painel">{navItems.slice(0, 5).map((item) => { const Icon = item.icon; return <button key={item.id} className={activePanel === item.id ? "is-active" : ""} onClick={() => openPanel(item.id)}><Icon size={19}/><span>{item.label === "Visão geral" ? "Início" : item.label}</span>{item.id === "orders" && pending.length > 0 && <b>{pending.length}</b>}</button>; })}</nav>

      {editorOpen && <AdminProductEditor product={editingProduct} categories={data.catalog.categories} onClose={() => setEditorOpen(false)} onSaved={productSaved}/>}
    </main>
  );
}
