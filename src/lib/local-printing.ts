import { formatCurrency } from "./money";
import type { Order } from "./types";

export const LOCAL_PRINTER_STORAGE_KEY = "dogchef-local-printer-name";

export type LocalPrintEvent =
  | "QZ_CONNECTION_ATTEMPT"
  | "QZ_CONNECTED"
  | "QZ_CONNECTION_FAILED"
  | "PRINTERS_DISCOVERED"
  | "PRINTER_SELECTED"
  | "PRINT_REQUESTED"
  | "PRINT_SENT"
  | "PRINT_FAILED"
  | "FALLBACK_REQUESTED";

export type LocalPrintLogger = (event: LocalPrintEvent, details?: Record<string, unknown>) => void;

export type LocalPrintAdapter = {
  isActive(): boolean;
  connect(options: { retries: number; delay: number }): Promise<void>;
  disconnect?(): Promise<void>;
  findPrinters(): Promise<string[]>;
  getDefaultPrinter(): Promise<string | undefined>;
  printHtml(printerName: string, html: string, jobName: string): Promise<void>;
};

export type LocalPrintErrorCode = "PRINT_IN_PROGRESS" | "PRINT_TIMEOUT";

export class LocalPrintError extends Error {
  constructor(public readonly code: LocalPrintErrorCode, message: string) {
    super(message);
    this.name = "LocalPrintError";
  }
}

export function shouldUseNativePrintFallback(error: unknown) {
  return !(error instanceof LocalPrintError && (error.code === "PRINT_IN_PROGRESS" || error.code === "PRINT_TIMEOUT"));
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function receiptDocument(title: string, body: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    body { width: 72mm; margin: 0 auto; color: #000; background: #fff; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.35; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 18px; text-align: center; }
    h2 { margin-top: 3px; font-size: 12px; text-align: center; }
    .divider { margin: 8px 0; border-top: 1px dashed #000; }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .row > :last-child { text-align: right; }
    .item { margin-top: 7px; }
    .item b { display: block; }
    .detail { display: block; padding-left: 10px; font-size: 10px; }
    .total { margin-top: 7px; font-size: 14px; font-weight: 700; }
    .center { text-align: center; }
    .break { overflow-wrap: anywhere; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function paymentLabel(order: Order) {
  if (order.paymentMethod === "pix") return "Pix";
  if (order.paymentMethod === "card") return "Cartao na entrega";
  return "Dinheiro na entrega";
}

function deliveryLabel(order: Order) {
  if (order.deliveryType === "pickup") return "Retirada no local";
  const address = order.customer.address;
  if (!address) return "Entrega";
  const parts = [
    `${address.street}, ${address.number}`,
    address.neighborhood,
    address.complement,
    address.reference ? `Ref.: ${address.reference}` : undefined,
  ].filter(Boolean);
  return parts.join(" - ");
}

export function buildOrderReceiptHtml(order: Order) {
  const createdAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(order.createdAt));
  const items = order.quote.items.map((item) => {
    const details = [
      ...item.optionals.map((optional) => `+ ${escapeHtml(optional.name)}`),
      item.note ? `Obs.: ${escapeHtml(item.note)}` : "",
    ].filter(Boolean).map((detail) => `<span class="detail">${detail}</span>`).join("");
    return `<div class="item"><div class="row"><b>${item.quantity}x ${escapeHtml(item.productName)}</b><span>${escapeHtml(formatCurrency(item.totalCents))}</span></div>${details}</div>`;
  }).join("");

  const body = `
    <h1>DOG DO CHEF</h1>
    <h2>PEDIDO ${escapeHtml(order.publicCode)}</h2>
    <div class="divider"></div>
    <div class="row"><span>Data</span><b>${escapeHtml(createdAt)}</b></div>
    <p class="break"><b>Cliente:</b> ${escapeHtml(order.customer.name)}</p>
    <p><b>Telefone:</b> ${escapeHtml(order.customer.phone)}</p>
    <p class="break"><b>${order.deliveryType === "pickup" ? "Modalidade" : "Endereco"}:</b> ${escapeHtml(deliveryLabel(order))}</p>
    <div class="divider"></div>
    ${items}
    <div class="divider"></div>
    <div class="row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(order.quote.subtotalCents))}</span></div>
    <div class="row"><span>Entrega</span><span>${escapeHtml(formatCurrency(order.quote.deliveryFeeCents))}</span></div>
    <div class="row total"><span>TOTAL</span><span>${escapeHtml(formatCurrency(order.quote.totalCents))}</span></div>
    <p><b>Pagamento:</b> ${escapeHtml(paymentLabel(order))}</p>
    <div class="divider"></div>
    <p class="center">Pedido salvo no DogChef</p>`;
  return receiptDocument(`DogChef ${order.publicCode}`, body);
}

export function buildTestReceiptHtml(printerName: string, date = new Date()) {
  const timestamp = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(date);
  return receiptDocument("DogChef - Teste de impressao", `
    <h1>DOGCHEF</h1>
    <h2>TESTE DE IMPRESSAO</h2>
    <div class="divider"></div>
    <p><b>Data e hora:</b> ${escapeHtml(timestamp)}</p>
    <p class="break"><b>Impressora:</b> ${escapeHtml(printerName)}</p>
    <p><b>Origem:</b> DogChef</p>
    <p><b>Ambiente:</b> ${process.env.NODE_ENV === "production" ? "Producao" : "Desenvolvimento"}</p>
    <div class="divider"></div>
    <p class="center">Se voce consegue ler isto,<br>a impressao foi enviada corretamente.</p>`);
}

export function chooseLocalPrinter(printers: string[], saved?: string | null, defaultPrinter?: string) {
  if (saved && printers.includes(saved)) return saved;
  if (defaultPrinter && printers.includes(defaultPrinter)) return defaultPrinter;
  return printers[0] ?? "";
}

export class LocalPrintCoordinator {
  private readonly jobsInProgress = new Set<string>();
  private discoveryInProgress?: Promise<{ printers: string[]; selectedPrinter: string; defaultPrinter?: string }>;
  private discoveryGeneration = 0;

  constructor(
    private readonly adapter: LocalPrintAdapter,
    private readonly log: LocalPrintLogger = (event, details) => console.info(`[DogChef Print] ${event}`, details ?? {}),
    private readonly connectionTimeoutMs = 15_000,
    private readonly printTimeoutMs = 30_000,
  ) {}

  isConnected() {
    return this.adapter.isActive();
  }

  connectAndDiscover(savedPrinter?: string | null) {
    if (!this.discoveryInProgress) {
      const generation = ++this.discoveryGeneration;
      const discovery = this.performDiscovery(savedPrinter, generation);
      this.discoveryInProgress = discovery;
      void discovery.then(
        () => { if (this.discoveryInProgress === discovery) this.discoveryInProgress = undefined; },
        () => { if (this.discoveryInProgress === discovery) this.discoveryInProgress = undefined; },
      );
    }
    return this.performBoundedDiscovery(this.discoveryInProgress);
  }

  private async performBoundedDiscovery(discovery: Promise<{ printers: string[]; selectedPrinter: string; defaultPrinter?: string }>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        discovery,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Tempo limite ao conectar com o QZ Tray.")), this.connectionTimeoutMs);
        }),
      ]);
    } catch (error) {
      this.log("QZ_CONNECTION_FAILED", { error: error instanceof Error ? error.message : "Falha desconhecida" });
      if (error instanceof Error && /tempo limite/i.test(error.message)) {
        if (this.discoveryInProgress === discovery) {
          this.discoveryInProgress = undefined;
          this.discoveryGeneration += 1;
        }
        void this.adapter.disconnect?.().catch(() => undefined);
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async performDiscovery(savedPrinter: string | null | undefined, generation: number) {
    this.log("QZ_CONNECTION_ATTEMPT");
    if (!this.adapter.isActive()) await this.adapter.connect({ retries: 2, delay: 1 });
    if (generation !== this.discoveryGeneration) throw new Error("Tentativa de conexao substituida por uma reconexao mais recente.");
    this.log("QZ_CONNECTED");
    const [printers, defaultPrinter] = await Promise.all([
      this.adapter.findPrinters(),
      this.adapter.getDefaultPrinter().catch(() => undefined),
    ]);
    if (generation !== this.discoveryGeneration) throw new Error("Descoberta de impressoras substituida por uma reconexao mais recente.");
    const uniquePrinters = [...new Set(printers.filter(Boolean))];
    this.log("PRINTERS_DISCOVERED", { count: uniquePrinters.length });
    const selectedPrinter = chooseLocalPrinter(uniquePrinters, savedPrinter, defaultPrinter);
    if (selectedPrinter) this.log("PRINTER_SELECTED", { printer: selectedPrinter });
    return { printers: uniquePrinters, selectedPrinter, defaultPrinter };
  }

  async print(jobKey: string, printerName: string, html: string) {
    if (this.jobsInProgress.has(jobKey)) throw new LocalPrintError("PRINT_IN_PROGRESS", "Este trabalho de impressao ja esta em andamento.");
    if (!printerName) throw new Error("Selecione uma impressora antes de imprimir.");
    this.jobsInProgress.add(jobKey);
    this.log("PRINT_REQUESTED", { jobKey, printer: printerName });
    const printTask = this.adapter.printHtml(printerName, html, `DogChef ${jobKey}`);
    void printTask.then(
      () => {
        this.log("PRINT_SENT", { jobKey, printer: printerName });
        this.jobsInProgress.delete(jobKey);
      },
      (error) => {
        this.log("PRINT_FAILED", { jobKey, printer: printerName, error: error instanceof Error ? error.message : "Falha desconhecida" });
        this.jobsInProgress.delete(jobKey);
      },
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        printTask,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new LocalPrintError(
            "PRINT_TIMEOUT",
            "O QZ Tray ainda nao confirmou o envio. Verifique a impressora antes de tentar novamente para evitar duas vias.",
          )), this.printTimeoutMs);
        }),
      ]);
    } catch (error) {
      if (error instanceof LocalPrintError && error.code === "PRINT_TIMEOUT") {
        this.log("PRINT_FAILED", { jobKey, printer: printerName, error: error.message, outcome: "unknown" });
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
