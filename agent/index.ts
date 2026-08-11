/*
 * DogChef local print agent. It never connects to Supabase directly: it only
 * polls the protected application API, claims a leased job, and emits ESC/POS.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { getPrinterAttributesRequest, ippRequest, ippStatusText, printJobRequest } from "./ipp";

type TicketLine = { productName: string; quantity: number; optionals: { name: string }[]; note?: string };
type Ticket = {
  printerId?: string;
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
type PrinterProfile = {
  id: string;
  name: string;
  transport: "tcp" | "windows-share" | "windows-raw" | "ipp";
  host?: string;
  port?: number;
  share?: string;
  windowsName?: string;
  ippUri?: string;
  ippDocumentFormat?: string;
  status?: "ready" | "offline" | "unknown";
  isDefault?: boolean;
};

const execFileAsync = promisify(execFile);
const agentDirectory = path.dirname(fileURLToPath(import.meta.url));
const spoolDirectory = path.join(agentDirectory, "print-spool");

function logEvent(event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...details }));
}

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

function printerProfiles(): PrinterProfile[] {
  const raw = process.env.PRINTER_PROFILES_JSON?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((profile): profile is PrinterProfile => {
      if (!profile || typeof profile !== "object") return false;
      const value = profile as Record<string, unknown>;
      return typeof value.id === "string" && typeof value.name === "string" && (value.transport === "tcp" || value.transport === "windows-share" || value.transport === "windows-raw" || value.transport === "ipp");
    });
  } catch {
    throw new Error("PRINTER_PROFILES_JSON inválido.");
  }
}

function windowsPrinterId(name: string) {
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "printer";
  const hash = createHash("sha1").update(name).digest("hex").slice(0, 8);
  return `windows-${slug}-${hash}`;
}

function windowsPrinterStatus(status: string, workOffline: boolean): "ready" | "offline" | "unknown" {
  if (workOffline || status === "7" || status.toLowerCase().includes("offline")) return "offline";
  if (["3", "4", "5", "idle", "printing", "warmup"].includes(status.toLowerCase())) return "ready";
  return "unknown";
}

let discoveredPrinterCache: { at: number; printers: PrinterProfile[] } | undefined;

async function discoverInstalledPrinters(): Promise<PrinterProfile[]> {
  if (process.platform !== "win32") return [];
  if (discoveredPrinterCache && Date.now() - discoveredPrinterCache.at < 15_000) return discoveredPrinterCache.printers;
  const script = [
    "$items = Get-CimInstance -ClassName Win32_Printer | ForEach-Object { [pscustomobject]@{ name = [string]$_.Name; isDefault = [bool]$_.Default; printerStatus = [string]$_.PrinterStatus; workOffline = [bool]$_.WorkOffline } }",
    "$items | ConvertTo-Json -Compress",
  ].join("; ");
  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { windowsHide: true, timeout: 10_000 });
    const parsed = JSON.parse(stdout.trim() || "[]") as unknown;
    const items = (Array.isArray(parsed) ? parsed : [parsed]).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    const printers = items
      .filter((item) => typeof item.name === "string" && item.name.trim())
      .map((item) => ({
        id: windowsPrinterId(String(item.name)),
        name: String(item.name).trim(),
        transport: "windows-raw" as const,
        windowsName: String(item.name).trim(),
        status: windowsPrinterStatus(String(item.printerStatus ?? ""), item.workOffline === true),
        isDefault: item.isDefault === true,
      }));
    discoveredPrinterCache = { at: Date.now(), printers };
    return printers;
  } catch {
    discoveredPrinterCache = { at: Date.now(), printers: [] };
    return [];
  }
}

function heartbeatPrinters(printers: PrinterProfile[]) {
  return printers.map((printer) => ({ id: printer.id, name: printer.name, status: printer.status ?? "unknown", isDefault: printer.isDefault === true }));
}

async function selectedPrinter(ticket: Ticket): Promise<PrinterProfile> {
  const profile = printerProfiles().find((candidate) => candidate.id === ticket.printerId);
  if (profile) return profile;
  const installed = await discoverInstalledPrinters();
  const installedProfile = installed.find((candidate) => candidate.id === ticket.printerId);
  if (installedProfile) return installedProfile;
  return {
    id: ticket.printerId || "default",
    name: "Impressora padrão",
    transport: (process.env.PRINTER_TRANSPORT || "tcp").toLowerCase() === "windows-share" ? "windows-share" : "tcp",
    host: process.env.PRINTER_HOST,
    port: Number(process.env.PRINTER_PORT || "9100"),
    share: process.env.PRINTER_SHARE,
  };
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

async function printTcp(data: Buffer, profile: PrinterProfile) {
  const host = profile.host || requireEnvironment("PRINTER_HOST");
  const port = Number(profile.port || process.env.PRINTER_PORT || "9100");
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

async function printWindowsShare(data: Buffer, jobId: string, profile: PrinterProfile) {
  if (process.platform !== "win32") throw new Error("O transporte USB/compartilhamento é suportado neste agente Windows.");
  const share = profile.share || requireEnvironment("PRINTER_SHARE");
  await mkdir(spoolDirectory, { recursive: true });
  const spoolFile = path.join(spoolDirectory, `${jobId}.bin`);
  await writeFile(spoolFile, data);
  // COPY /B preserves the ESC/POS byte stream for a Windows shared raw printer.
  await execFileAsync("cmd.exe", ["/d", "/s", "/c", `copy /b "${spoolFile}" "${share}"`], { windowsHide: true, timeout: 10_000 });
}

async function printWindowsRaw(data: Buffer, jobId: string, profile: PrinterProfile) {
  if (process.platform !== "win32") throw new Error("A impressão direta só está disponível no agente Windows.");
  if (!profile.windowsName) throw new Error("A impressora Windows não foi identificada.");
  await mkdir(spoolDirectory, { recursive: true });
  const spoolFile = path.join(spoolDirectory, `${jobId}.bin`);
  await writeFile(spoolFile, data);
  const script = String.raw`
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public static class DogChefRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DocInfo { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool OpenPrinter(string name, out IntPtr printer, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr printer);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern int StartDocPrinter(IntPtr printer, int level, [In] DocInfo doc);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr printer);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool StartPagePrinter(IntPtr printer);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr printer);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool WritePrinter(IntPtr printer, byte[] bytes, int count, out int written);
  public static void Send(string printerName, string fileName) {
    IntPtr printer;
    if (!OpenPrinter(printerName, out printer, IntPtr.Zero)) throw new Exception("Não foi possível abrir a impressora Windows.");
    try {
      var doc = new DocInfo { pDocName = "DogChef", pDataType = "RAW", pOutputFile = null };
      if (StartDocPrinter(printer, 1, doc) == 0) throw new Exception("Não foi possível iniciar o trabalho de impressão.");
      try {
        if (!StartPagePrinter(printer)) throw new Exception("Não foi possível iniciar a página.");
        try {
          var bytes = File.ReadAllBytes(fileName); int written;
          if (!WritePrinter(printer, bytes, bytes.Length, out written) || written != bytes.Length) throw new Exception("A impressora não aceitou todos os dados.");
        } finally { EndPagePrinter(printer); }
      } finally { EndDocPrinter(printer); }
    } finally { ClosePrinter(printer); }
  }
}

"@
[DogChefRawPrinter]::Send($env:DOGCHEF_PRINTER_NAME, $env:DOGCHEF_SPOOL_FILE)
`;
  await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
    windowsHide: true,
    timeout: 15_000,
    env: { ...process.env, DOGCHEF_PRINTER_NAME: profile.windowsName, DOGCHEF_SPOOL_FILE: spoolFile },
  });
}

async function printIpp(data: Buffer, jobId: string, profile: PrinterProfile) {
  const uri = profile.ippUri || requireEnvironment("PRINTER_IPP_URI");
  const documentFormat = profile.ippDocumentFormat || process.env.PRINTER_IPP_DOCUMENT_FORMAT || "application/octet-stream";
  const response = await ippRequest(uri, printJobRequest(uri, data, documentFormat));
  logEvent("IPP_JOB_ACCEPTED", { jobId, printer: profile.name, status: ippStatusText(response.statusCode) });
}

async function printTicket(ticket: Ticket, jobId: string, directProfile?: PrinterProfile) {
  const profile = directProfile ?? await selectedPrinter(ticket);
  const data = escpos(ticket, jobId);
  if (profile.transport === "ipp") {
    await printIpp(data, jobId, profile);
    return;
  }
  if (profile.transport === "windows-raw") {
    await printWindowsRaw(data, jobId, profile);
    return;
  }
  if (profile.transport === "windows-share") {
    await printWindowsShare(data, jobId, profile);
  } else {
    await printTcp(data, profile);
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

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function listPrinters() {
  await loadDotEnv();
  const installed = await discoverInstalledPrinters();
  const profiles = installed.length ? installed : printerProfiles();
  logEvent("PRINTER_DISCOVERY", { count: profiles.length, source: installed.length ? "windows" : "configured" });
  if (!profiles.length) {
    console.log("Nenhuma impressora foi encontrada. Instale a impressora no Windows ou configure PRINTER_PROFILES_JSON.");
    return;
  }
  console.log("Impressoras reconhecidas pelo agente:");
  for (const printer of profiles) {
    const state = printer.status === "offline" ? "offline" : printer.status === "ready" ? "pronta" : "estado desconhecido";
    console.log(`- ${printer.name} | id=${printer.id} | ${state}${printer.isDefault ? " | padrão" : ""}`);
  }
}

async function printTest() {
  await loadDotEnv();
  const installed = await discoverInstalledPrinters();
  const profiles = installed.length ? installed : printerProfiles();
  const requestedId = argumentValue("--printer-id");
  const ippUri = argumentValue("--ipp-url");
  const overrideProfile = ippUri ? { id: "ipp-command-line", name: `IPP ${ippUri}`, transport: "ipp" as const, ippUri, ippDocumentFormat: "text/plain" } : undefined;
  const printerId = requestedId || overrideProfile?.id || profiles[0]?.id;
  if (!printerId) throw new Error("Nenhuma impressora encontrada. Rode --list ou configure PRINTER_PROFILES_JSON.");
  const profile = overrideProfile ?? await selectedPrinter({ printerId, publicCode: "TESTE", createdAt: new Date().toISOString(), customerName: "Teste DogChef", customerPhone: "", deliveryType: "pickup", items: [], totalCents: 0, paymentMethod: "cash" });
  console.log(`Enviando teste para ${profile.name} (${profile.id})...`);
  const jobId = `teste-${Date.now()}`;
  try {
    await printTicket({
      printerId: profile.id,
      publicCode: "TESTE",
      createdAt: new Date().toISOString(),
      customerName: "Teste DogChef",
      customerPhone: "",
      deliveryType: "pickup",
      items: [{ productName: "Teste de impressão", quantity: 1, optionals: [], note: "Se este papel saiu, a conexão está funcionando." }],
      totalCents: 0,
      paymentMethod: "cash",
    }, jobId, profile);
  } catch (error) {
    logEvent("PRINT_JOB_FAILED", { jobId, printer: profile.name, error: error instanceof Error ? error.message.slice(0, 450) : "Erro desconhecido" });
    throw error;
  }
  logEvent("PRINT_JOB_SUCCESS", { jobId, printer: profile.name, protocol: profile.transport });
  console.log("Teste enviado com sucesso.");
}

async function diagnosePrinter() {
  await loadDotEnv();
  const installed = await discoverInstalledPrinters();
  const profiles = installed.length ? installed : printerProfiles();
  const requestedId = argumentValue("--printer-id");
  const ippUri = argumentValue("--ipp-url");
  const overrideProfile = ippUri ? { id: "ipp-command-line", name: `IPP ${ippUri}`, transport: "ipp" as const, ippUri } : undefined;
  const profile = overrideProfile ?? profiles.find((printer) => printer.id === requestedId) ?? profiles[0];
  if (!profile) throw new Error("Nenhuma impressora encontrada. Rode --list ou configure um perfil.");
  console.log(`Impressora: ${profile.name}`);
  console.log(`ID: ${profile.id}`);
  console.log(`Transporte: ${profile.transport}`);
  if (profile.transport === "windows-raw") {
    if (profile.status === "offline") logEvent("PRINTER_OFFLINE", { printer: profile.name });
    else logEvent("PRINTER_CONNECTION", { printer: profile.name, protocol: "windows-spooler" });
    console.log(`Windows: ${profile.status === "offline" ? "offline" : "reconhecida pelo spooler"}`);
    return;
  }
  if (profile.transport === "tcp") {
    const host = profile.host || requireEnvironment("PRINTER_HOST");
    const port = Number(profile.port || process.env.PRINTER_PORT || "9100");
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host, port });
      const timer = setTimeout(() => { socket.destroy(); reject(new Error("Timeout TCP.")); }, 8_000);
      socket.once("error", (error) => { clearTimeout(timer); reject(error); });
      socket.once("connect", () => { clearTimeout(timer); socket.end(); resolve(); });
    });
    logEvent("PRINTER_CONNECTION", { printer: profile.name, protocol: "tcp", host, port });
    console.log(`TCP: conectado em ${host}:${port}`);
    return;
  }
  if (profile.transport === "windows-share") {
    console.log(`Compartilhamento: ${profile.share || process.env.PRINTER_SHARE || "não configurado"}`);
    return;
  }
  const uri = profile.ippUri || requireEnvironment("PRINTER_IPP_URI");
  try {
    const response = await ippRequest(uri, getPrinterAttributesRequest(uri));
    logEvent("IPP_CONNECTED", { printer: profile.name, uri, status: ippStatusText(response.statusCode) });
    console.log(`IPP: ${uri}`);
    console.log(`IPP status: ${ippStatusText(response.statusCode)}`);
    console.log("IPP Get-Printer-Attributes: aceito");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha IPP";
    logEvent(message.includes("Tempo limite") ? "IPP_TIMEOUT" : "PRINTER_CONNECTION_FAILED", { printer: profile.name, uri, error: message.slice(0, 450) });
    throw error;
  }
}

async function run() {
  await loadDotEnv();
  const agentId = process.env.PRINT_AGENT_ID || `cozinha-${os.hostname()}`;
  logEvent("PRINT_SERVICE_STARTED", { agentId });
  let serviceConnected = false;
  let backoff = 2_500;
  for (;;) {
    try {
      const discoveredPrinters = await discoverInstalledPrinters();
      const advertisedPrinters = discoveredPrinters.length ? discoveredPrinters : printerProfiles();
      await request("/api/v1/print-agent/heartbeat", { agentId, printers: heartbeatPrinters(advertisedPrinters) });
      if (!serviceConnected) {
        serviceConnected = true;
        logEvent("PRINT_SERVICE_CONNECTED", { agentId, printers: advertisedPrinters.length });
      }
      const result = await request("/api/v1/print-agent/jobs/claim", { agentId, limit: 1 });
      const jobs = Array.isArray(result.jobs) ? result.jobs as Job[] : [];
      if (jobs.length) logEvent("PRINT_JOB_CREATED", { count: jobs.length });
      for (const job of jobs) {
        try {
          if (!await wasPrinted(job.id)) { await printTicket(job.payload, job.id); await markPrinted(job.id); }
          await complete(job, "printed");
          logEvent("PRINT_JOB_SUCCESS", { jobId: job.id, printer: job.payload.printerId });
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 450) : "Erro desconhecido de impressão";
          await complete(job, "failed", message).catch(() => undefined);
          logEvent("PRINT_JOB_FAILED", { jobId: job.id, error: message });
        }
      }
      backoff = jobs.length ? 1_000 : 3_000;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro de comunicação";
      if (serviceConnected) {
        serviceConnected = false;
        logEvent("PRINT_SERVICE_DISCONNECTED", { reason: message.slice(0, 250) });
      }
      logEvent("PRINT_SERVICE_RETRY", { reason: message.slice(0, 250) });
      backoff = Math.min(backoff * 2, 30_000);
    }
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }
}

const command = process.argv.find((argument) => argument === "--list" || argument === "--test" || argument === "--diagnose");
const commandTask = command === "--list" ? listPrinters() : command === "--test" ? printTest() : command === "--diagnose" ? diagnosePrinter() : run();
void commandTask.catch((error) => { console.error(error); process.exitCode = 1; });
