import { z } from "zod";

const printerSchema = z.object({
  id: z.string().trim().min(1).max(60).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(1).max(80),
  transport: z.enum(["tcp", "windows-share"]).optional(),
});

export type PrinterOption = { id: string; name: string };

const fallbackPrinter: PrinterOption = { id: "default", name: "Impressora padrão da cozinha" };

export function configuredPrinterOptions(): PrinterOption[] {
  const raw = process.env.PRINT_PRINTER_OPTIONS?.trim();
  if (!raw) return [fallbackPrinter];
  try {
    const parsed = z.array(printerSchema).max(20).safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.length === 0) return [fallbackPrinter];
    return parsed.data.map(({ id, name }) => ({ id, name }));
  } catch {
    return [fallbackPrinter];
  }
}

export function defaultPrinterId() {
  return configuredPrinterOptions()[0]?.id ?? fallbackPrinter.id;
}

export function isConfiguredPrinter(id: string) {
  return configuredPrinterOptions().some((printer) => printer.id === id);
}
