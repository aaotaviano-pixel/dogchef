/*
 * DogChef local print agent. It never connects to Supabase directly: it only
 * polls the protected application API, claims a leased job, and emits ESC/POS.
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

type TicketLine = { productName: string; quantity: number; optionals: { name: string }[]; note?: string };
type Ticket = {
  publicCode: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  deliveryType: "delivery" | "pickup";
  address?: { street: string; number: string; neighborhood: string; complement?: string };
  items: TicketLine[];
  totalCents: number;
  paymentMethod: string;
};
type Job = { id: string; leaseToken: string; payload: Ticket };

const execFileAsync = promisify(execFile);
const agentDirectory = path.dirname(fileURLToPath(import.meta.url));
const spoolDirectory = path.join(agentDirectory, "print-spool");

async function loadDotEnv() {
  try {
    const source = await readFile(path.join(agentDirectory, ".env"), "utf8");
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch { /* using process environment is valid */ }
}

function requireEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function money(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function clean(text: string) {
  // ESC/POS basic printers are safer with a simple Latin-1/ASCII repertoire.
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "?");
}

function escpos(ticket: Ticket, jobId: string) {
  const center = "\x1B\x61\x01";
  const left = "\x1B\x61\x00";
  const boldOn = "\x1B\x45\x01";
  const boldOff = "\x1B\x45\x00";
  const doubleSize = "\x1D\x21\x11";
  const normalSize = "\x1D\x21\x00";
  const line = "--------------------------------\n";
  const address = ticket.address ? `${ticket.address.street}, ${ticket.address.number} - ${ticket.address.neighborhood}${ticket.address.complement ? ` (${ticket.address.complement})` : ""}` : "RETIRADA NO BALCAO";
  const items = ticket.items.map((item) => {
    const options = item.optionals.map((option) => `  + ${option.name}\n`).join("");
    return `${item.quantity}x ${item.productName}\n${options}${item.note ? `  OBS: ${item.note}\n` : ""}`;
  }).join("");
  const content = [
    "\x1B\x40", center, boldOn, doubleSize, "DOGCHEF\n", normalSize, boldOff,
    "Pedido quentinho, feito na hora\n", line, left, boldOn, `PEDIDO ${ticket.publicCode}\n`, boldOff,
    `Data: ${new Date(ticket.createdAt).toLocaleString("pt-BR")}\n`, `Cliente: ${ticket.customerName}\n`, `Fone: ${ticket.customerPhone}\n`,
    `Tipo: ${ticket.deliveryType === "delivery" ? "ENTREGA" : "RETIRADA"}\n`, `Local: ${address}\n`, line,
    boldOn, "ITENS\n", boldOff, items, line, boldOn, `TOTAL: ${money(ticket.totalCents)}\n`, boldOff,
    `Pagamento: ${ticket.paymentMethod.toUpperCase()}\n`, line, center, `Job: ${jobId}\n`, "Obrigado!\n\n\n", "\x1D\x56\x00",
  ].join("");
  return Buffer.from(clean(content), "ascii");
}

async function printTcp(data: Buffer) {
  const host = requireEnvironment("PRINTER_HOST");
  const port = Number(process.env.PRINTER_PORT || "9100");
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error("Tempo de conexão da impressora excedido.")); }, 8000);
    socket.once("error", (error) => { clearTimeout(timer); reject(error); });
    socket.once("connect", () => socket.write(data, (error) => {
      clearTimeout(timer);
      if (error) { reject(error); return; }
      socket.end(); resolve();
    }));
  });
}

async function printWindowsShare(data: Buffer, jobId: string) {
  if (process.platform !== "win32") throw new Error("O transporte USB/compartilhamento é suportado neste agente Windows.");
  const share = requireEnvironment("PRINTER_SHARE");
  await mkdir(spoolDirectory, { recursive: true });
  const spoolFile = path.join(spoolDirectory, `${jobId}.bin`);
  await writeFile(spoolFile, data);
  // COPY /B preserves the ESC/POS byte stream for a Windows shared raw printer.
  await execFileAsync("cmd.exe", ["/d", "/s", "/c", `copy /b "${spoolFile}" "${share}"`], { windowsHide: true, timeout: 10_000 });
}

async function printTicket(ticket: Ticket, jobId: string) {
  const data = escpos(ticket, jobId);
  if ((process.env.PRINTER_TRANSPORT || "tcp").toLowerCase() === "windows-share") {
    await printWindowsShare(data, jobId);
  } else {
    await printTcp(data);
  }
}

function completedPath(jobId: string) { return path.join(spoolDirectory, `${jobId}.done`); }

async function wasPrinted(jobId: string) {
  try { await readFile(completedPath(jobId)); return true; } catch { return false; }
}

async function markPrinted(jobId: string) {
  await mkdir(spoolDirectory, { recursive: true });
  await writeFile(completedPath(jobId), new Date().toISOString(), "utf8");
}

async function request(pathname: string, body?: unknown) {
  const baseUrl = requireEnvironment("DOGCHEF_API_URL").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnvironment("PRINT_AGENT_TOKEN")}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : `API retornou ${response.status}`);
  return json as Record<string, unknown>;
}

async function complete(job: Job, result: "printed" | "failed", error?: string) {
  await request(`/api/v1/print-agent/jobs/${job.id}/complete`, { leaseToken: job.leaseToken, result, error });
}

async function run() {
  await loadDotEnv();
  const agentId = process.env.PRINT_AGENT_ID || `cozinha-${os.hostname()}`;
  console.log(`DogChef Print Agent conectado como ${agentId}.`);
  let backoff = 2_500;
  for (;;) {
    try {
      await request("/api/v1/print-agent/heartbeat", { agentId });
      const result = await request("/api/v1/print-agent/jobs/claim", { agentId, limit: 1 });
      const jobs = Array.isArray(result.jobs) ? result.jobs as Job[] : [];
      for (const job of jobs) {
        try {
          if (!await wasPrinted(job.id)) { await printTicket(job.payload, job.id); await markPrinted(job.id); }
          await complete(job, "printed");
          console.log(`Impresso: ${job.id}`);
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 450) : "Erro desconhecido de impressão";
          await complete(job, "failed", message).catch(() => undefined);
          console.error(`Falha ao imprimir ${job.id}: ${message}`);
        }
      }
      backoff = jobs.length ? 1_000 : 3_000;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro de comunicação";
      console.error(`Agente aguardando nova tentativa: ${message}`);
      backoff = Math.min(backoff * 2, 30_000);
    }
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }
}

void run().catch((error) => { console.error(error); process.exitCode = 1; });
