import { createHash } from "node:crypto";

export type WindowsPrinterRecord = {
  name: string;
  isDefault?: boolean;
  printerStatus?: string;
  workOffline?: boolean;
  driverName?: string;
};

export type WindowsPrinterProfile = {
  id: string;
  name: string;
  transport: "windows-raw";
  windowsName: string;
  status: "ready" | "offline" | "unknown";
  isDefault: boolean;
};

const virtualPrinterPattern = /(?:onenote|print to pdf|xps document writer|send to onenote)/i;

export function windowsPrinterId(name: string) {
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "printer";
  const hash = createHash("sha1").update(name).digest("hex").slice(0, 8);
  return `windows-${slug}-${hash}`;
}

export function windowsPrinterStatus(status: string, workOffline: boolean): "ready" | "offline" | "unknown" {
  if (workOffline || status === "7" || status.toLowerCase().includes("offline")) return "offline";
  if (["3", "4", "5", "idle", "printing", "warmup"].includes(status.toLowerCase())) return "ready";
  return "unknown";
}

export function isVirtualWindowsPrinter(printer: Pick<WindowsPrinterRecord, "name" | "driverName">) {
  return /^fax$/i.test(printer.name.trim()) || virtualPrinterPattern.test(`${printer.name} ${printer.driverName ?? ""}`);
}

export function discoverWindowsPrinters(records: WindowsPrinterRecord[], includeVirtual = false): WindowsPrinterProfile[] {
  return records
    .filter((printer) => printer.name.trim())
    .filter((printer) => includeVirtual || !isVirtualWindowsPrinter(printer))
    .map((printer) => ({
      id: windowsPrinterId(printer.name.trim()),
      name: printer.name.trim(),
      transport: "windows-raw" as const,
      windowsName: printer.name.trim(),
      status: windowsPrinterStatus(printer.printerStatus ?? "", printer.workOffline === true),
      isDefault: printer.isDefault === true,
    }));
}
