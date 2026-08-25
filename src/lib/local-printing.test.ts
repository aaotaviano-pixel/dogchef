import assert from "node:assert/strict";
import test from "node:test";

import type { Order } from "./types";
import {
  LocalPrintError,
  LocalPrintCoordinator,
  buildOrderReceiptHtml,
  buildTestReceiptHtml,
  chooseLocalPrinter,
  shouldUseNativePrintFallback,
  type LocalPrintAdapter,
} from "./local-printing";

const order: Order = {
  id: "order-1",
  publicCode: "DOG-1234",
  version: 1,
  createdAt: "2026-08-25T20:30:00.000Z",
  updatedAt: "2026-08-25T20:30:00.000Z",
  status: "confirmed",
  paymentStatus: "not_required",
  paymentMethod: "cash",
  deliveryType: "delivery",
  customer: {
    name: "Ana <script>",
    phone: "(11) 99999-0000",
    address: { street: "Rua A", number: "10", neighborhood: "Centro", complement: "Apto 2" },
  },
  quote: {
    items: [{
      productId: "dog-1",
      productName: "Dog Bacon",
      quantity: 2,
      unitPriceCents: 1800,
      optionals: [{ id: "extra-1", name: "Cheddar", priceCents: 300 }],
      note: "Sem cebola & caprichado",
      totalCents: 4200,
    }],
    subtotalCents: 4200,
    deliveryFeeCents: 800,
    totalCents: 5000,
    deliveryZone: "Centro",
  },
  events: [],
};

test("gera cupom do pedido sem injetar HTML do cliente", () => {
  const html = buildOrderReceiptHtml(order);

  assert.match(html, /DOG-1234/);
  assert.match(html, /Dog Bacon/);
  assert.match(html, /Cheddar/);
  assert.match(html, /R\$\s*50,00/);
  assert.match(html, /Ana &lt;script&gt;/);
  assert.doesNotMatch(html, /Ana <script>/);
});

test("gera teste curto com a impressora selecionada", () => {
  const html = buildTestReceiptHtml("EPSON TM-T20", new Date("2026-08-25T20:30:00.000Z"));
  assert.match(html, /TESTE DE IMPRESS/);
  assert.match(html, /EPSON TM-T20/);
  assert.match(html, /DogChef/);
});

test("mantem a impressora salva, depois prefere a padrao", () => {
  const printers = ["Cozinha", "Balcao"];
  assert.equal(chooseLocalPrinter(printers, "Cozinha", "Balcao"), "Cozinha");
  assert.equal(chooseLocalPrinter(printers, "Ausente", "Balcao"), "Balcao");
  assert.equal(chooseLocalPrinter(printers, "Ausente", "Ausente"), "Cozinha");
});

test("descobre filas reais e registra eventos de conexao", async () => {
  const events: string[] = [];
  const adapter: LocalPrintAdapter = {
    isActive: () => false,
    connect: async () => undefined,
    findPrinters: async () => ["Cozinha", "Balcao"],
    getDefaultPrinter: async () => "Balcao",
    printHtml: async () => undefined,
  };
  const coordinator = new LocalPrintCoordinator(adapter, (event) => events.push(event));

  const result = await coordinator.connectAndDiscover("Cozinha");

  assert.deepEqual(result, { printers: ["Cozinha", "Balcao"], selectedPrinter: "Cozinha", defaultPrinter: "Balcao" });
  assert.deepEqual(events, ["QZ_CONNECTION_ATTEMPT", "QZ_CONNECTED", "PRINTERS_DISCOVERED", "PRINTER_SELECTED"]);
});

test("compartilha uma unica conexao quando dois ciclos iniciam juntos", async () => {
  let connects = 0;
  let discoveries = 0;
  const adapter: LocalPrintAdapter = {
    isActive: () => false,
    connect: async () => { connects += 1; },
    findPrinters: async () => { discoveries += 1; return ["Cozinha"]; },
    getDefaultPrinter: async () => "Cozinha",
    printHtml: async () => undefined,
  };
  const coordinator = new LocalPrintCoordinator(adapter);

  const [first, second] = await Promise.all([
    coordinator.connectAndDiscover("Cozinha"),
    coordinator.connectAndDiscover("Cozinha"),
  ]);

  assert.deepEqual(first, second);
  assert.equal(connects, 1);
  assert.equal(discoveries, 1);
});

test("encerra uma conexao que nao responde dentro do limite", async () => {
  let connects = 0;
  const adapter: LocalPrintAdapter = {
    isActive: () => false,
    connect: async () => { connects += 1; return new Promise<void>(() => undefined); },
    disconnect: async () => new Promise<void>(() => undefined),
    findPrinters: async () => [],
    getDefaultPrinter: async () => undefined,
    printHtml: async () => undefined,
  };
  const coordinator = new LocalPrintCoordinator(adapter, () => undefined, 15);

  await assert.rejects(coordinator.connectAndDiscover(), /tempo limite/i);
  await assert.rejects(coordinator.connectAndDiscover(), /tempo limite/i);
  assert.equal(connects, 2);
});

test("bloqueia trabalho duplicado enquanto o primeiro ainda esta em andamento", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const adapter: LocalPrintAdapter = {
    isActive: () => true,
    connect: async () => undefined,
    findPrinters: async () => ["Cozinha"],
    getDefaultPrinter: async () => "Cozinha",
    printHtml: async () => pending,
  };
  const coordinator = new LocalPrintCoordinator(adapter);
  const first = coordinator.print("order-1", "Cozinha", "<html></html>");

  await assert.rejects(
    coordinator.print("order-1", "Cozinha", "<html></html>"),
    (error) => error instanceof LocalPrintError && error.code === "PRINT_IN_PROGRESS",
  );
  finish();
  await first;
});

test("nao abre fallback nativo para duplicidade ou resultado de envio incerto", () => {
  assert.equal(shouldUseNativePrintFallback(new LocalPrintError("PRINT_IN_PROGRESS", "duplicado")), false);
  assert.equal(shouldUseNativePrintFallback(new LocalPrintError("PRINT_TIMEOUT", "incerto")), false);
  assert.equal(shouldUseNativePrintFallback(new Error("QZ Tray esta desconectado.")), true);
});

test("limita o envio sem liberar uma segunda via enquanto o QZ continua pendente", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const adapter: LocalPrintAdapter = {
    isActive: () => true,
    connect: async () => undefined,
    findPrinters: async () => ["Cozinha"],
    getDefaultPrinter: async () => "Cozinha",
    printHtml: async () => pending,
  };
  const coordinator = new LocalPrintCoordinator(adapter, () => undefined, 50, 15);

  await assert.rejects(
    coordinator.print("order-timeout", "Cozinha", "<html></html>"),
    (error) => error instanceof LocalPrintError && error.code === "PRINT_TIMEOUT",
  );
  await assert.rejects(
    coordinator.print("order-timeout", "Cozinha", "<html></html>"),
    (error) => error instanceof LocalPrintError && error.code === "PRINT_IN_PROGRESS",
  );
  finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await coordinator.print("order-timeout", "Cozinha", "<html></html>");
});

test("libera o bloqueio depois de uma falha para permitir nova tentativa", async () => {
  let attempts = 0;
  const adapter: LocalPrintAdapter = {
    isActive: () => true,
    connect: async () => undefined,
    findPrinters: async () => ["Cozinha"],
    getDefaultPrinter: async () => "Cozinha",
    printHtml: async () => { attempts += 1; if (attempts === 1) throw new Error("offline"); },
  };
  const coordinator = new LocalPrintCoordinator(adapter);

  await assert.rejects(coordinator.print("order-1", "Cozinha", "<html></html>"), /offline/);
  await coordinator.print("order-1", "Cozinha", "<html></html>");
  assert.equal(attempts, 2);
});
