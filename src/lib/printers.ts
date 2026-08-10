import { z } from "zod";

const printerSchema = z.object({
  id: z.string().trim().min(1).max(60).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(1).max(80),
  transport: z.enum(["tcp", "windows-share"]).optional(),
});

const discoveredPrinterSchema = z.object({
  id: z.string().trim().min(1).max(60).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  status: z.enum(["ready", "offline", "unknown"]).optional(),
  isDefault: z.boolean().optional(),
});

import type { PrinterOption } from "@/lib/types";

export { type PrinterOption };

const fallbackPrinter: PrinterOption = { id: "default", name: "Impressora padrão da cozinha" };

export function configuredPrinterOptions(): PrinterOption[] {
  const raw = process.env.PRINT_PRINTER_OPTIONS?.trim();
  if (!raw) return [fallbackPrinter];
  try {
    const parsed = z.array(printerSchema).max(20).safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.length === 0) return [fallbackPrinter];
    return parsed.data.map(({ id, name }) => ({ id, name, source: "configured" as const }));
  } catch {
    return [fallbackPrinter];
  }
}

export function parseDiscoveredPrinters(input: unknown): PrinterOption[] {
  const parsed = z.array(discoveredPrinterSchema).max(50).safeParse(input);
  if (!parsed.success) return [];
  return parsed.data.map((printer) => ({ ...printer, source: "windows" as const }));
}

export function defaultPrinterId() {
  return configuredPrinterOptions()[0]?.id ?? fallbackPrinter.id;
}

export function isConfiguredPrinter(id: string) {
  return configuredPrinterOptions().some((printer) => printer.id === id);
}
