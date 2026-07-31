"use client";

import { useEffect, useState } from "react";
import { Check, ChefHat, ClipboardCheck, Copy, House, MapPin, PackageCheck, ReceiptText, Truck, XCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { formatCurrency } from "@/lib/money";
import type { Order } from "@/lib/types";

const statusInfo = {
  pending_approval: { title: "Recebemos seu pedido", copy: "A cozinha vai conferir os detalhes em instantes.", icon: ClipboardCheck },
  confirmed: { title: "Pedido confirmado", copy: "Tudo certo! Já entramos na fila da cozinha.", icon: Check },
  preparing: { title: "Na chapa", copy: "Seu pedido está sendo preparado agora.", icon: ChefHat },
  out_for_delivery: { title: "A caminho", copy: "A entrega saiu e deve chegar quentinha.", icon: Truck },
  delivered: { title: "Bom apetite!", copy: "Pedido concluído. Obrigado por escolher a DogChef.", icon: PackageCheck },
  cancelled: { title: "Pedido cancelado", copy: "Se precisar, fale com a loja para entendermos o ocorrido.", icon: XCircle },
} as const;

export function OrderTracker({ publicCode, token }: { publicCode: string; token: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/v1/orders/${encodeURIComponent(publicCode)}?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Pedido não encontrado.");
        if (active) { setOrder(data.order); setError(""); }
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Não foi possível consultar o pedido.");
      }
    };
    void load();
    const interval = window.setInterval(load, 10_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [publicCode, token]);

  if (error) return <main className="tracker-shell"><div className="tracker-card"><span className="brand-mark">D</span><h1>Não encontramos esse pedido.</h1><p>{error}</p><Link className="button button-primary" href="/">Voltar ao cardápio</Link></div></main>;
  if (!order) return <main className="tracker-shell"><div className="tracker-card loading-card"><span className="brand-mark">D</span><p>Preparando o acompanhamento do seu pedido…</p></div></main>;

  const current = statusInfo[order.status];
  const CurrentIcon = current.icon;
  const flow = order.deliveryType === "delivery" ? ["pending_approval", "confirmed", "preparing", "out_for_delivery", "delivered"] : ["pending_approval", "confirmed", "preparing", "delivered"];
  const currentIndex = flow.indexOf(order.status);

  async function copyPix() {
    if (!order?.payment?.pixCopyPaste) return;
    await navigator.clipboard.writeText(order.payment.pixCopyPaste);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <main className="tracker-shell"><header className="tracker-header"><Link href="/" className="brand-lockup"><span className="brand-mark">D</span><span><strong>DogChef</strong><small>seu pedido</small></span></Link><Link href="/" className="text-link"><House size={17}/>Cardápio</Link></header><section className="tracker-card"><p className="eyebrow">Pedido <strong>{order.publicCode}</strong></p><div className={`status-icon ${order.status}`}><CurrentIcon size={30}/></div><h1>{current.title}</h1><p className="tracker-lead">{current.copy}</p>{order.status !== "cancelled" && <div className="order-progress">{flow.map((status, index) => <div key={status} className={`progress-step ${index <= currentIndex ? "done" : ""}`}><span>{index < currentIndex ? <Check size={13}/> : index + 1}</span><small>{status === "pending_approval" ? "Recebido" : status === "confirmed" ? "Confirmado" : status === "preparing" ? "Preparo" : status === "out_for_delivery" ? "A caminho" : "Concluído"}</small></div>)}</div>}{order.paymentMethod === "pix" && order.paymentStatus === "pending" && <section className="pix-card"><div><p className="eyebrow">Pagamento Pix</p><h2>Escaneie ou copie o código</h2>{order.payment?.qrCodeBase64 && <Image alt="QR Code Pix" src={`data:image/png;base64,${order.payment.qrCodeBase64}`} width={150} height={150} unoptimized />}</div>{order.payment?.pixCopyPaste ? <><button className="copy-pix" onClick={copyPix}><Copy size={17}/>{copied ? "Código copiado" : "Copiar Pix copia e cola"}</button><small>Válido até {order.payment.expiresAt ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(order.payment.expiresAt)) : "a confirmação do pagamento"}.</small></> : <p>Estamos aguardando a geração do código Pix. Atualize esta tela em instantes.</p>}</section>}<section className="receipt"><div className="receipt-heading"><span><ReceiptText size={19}/>Resumo</span><strong>{formatCurrency(order.quote.totalCents)}</strong></div>{order.quote.items.map((item, index) => <div className="receipt-line" key={`${item.productId}-${index}`}><span><b>{item.quantity}× {item.productName}</b>{item.optionals.length > 0 && <small>{item.optionals.map((option) => option.name).join(", ")}</small>}{item.note && <small>Obs.: {item.note}</small>}</span><strong>{formatCurrency(item.totalCents)}</strong></div>)}<div className="receipt-total"><span>Subtotal</span><strong>{formatCurrency(order.quote.subtotalCents)}</strong></div>{order.deliveryType === "delivery" && <div className="receipt-total"><span>Entrega</span><strong>{formatCurrency(order.quote.deliveryFeeCents)}</strong></div>}<div className="receipt-total grand"><span>Total</span><strong>{formatCurrency(order.quote.totalCents)}</strong></div></section>{order.deliveryType === "delivery" && order.customer.address && <p className="delivery-address"><MapPin size={18}/>{order.customer.address.street}, {order.customer.address.number} · {order.customer.address.neighborhood}</p>}<p className="tracker-refresh">Esta página se atualiza automaticamente a cada 10 segundos.</p></section></main>;
}
