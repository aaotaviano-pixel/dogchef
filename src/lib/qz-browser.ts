import type { LocalPrintAdapter } from "./local-printing";

type QzModule = typeof import("qz-tray");

let loadedQz: QzModule | undefined;
let loadingQz: Promise<QzModule> | undefined;

async function getQz() {
  if (loadedQz) return loadedQz;
  loadingQz ??= import("qz-tray").then((module) => {
    const qz = (module as unknown as { default?: QzModule }).default ?? module;
    loadedQz = qz;
    return qz;
  });
  return loadingQz;
}

export function createBrowserQzAdapter(onClosed?: () => void): LocalPrintAdapter {
  let callbacksConfigured = false;

  async function configureCallbacks(qz: QzModule) {
    if (callbacksConfigured) return;
    qz.websocket.setClosedCallbacks(() => onClosed?.());
    qz.websocket.setErrorCallbacks((error) => console.warn("[DogChef Print] QZ_CONNECTION_FAILED", error));
    callbacksConfigured = true;
  }

  return {
    isActive() {
      return loadedQz?.websocket.isActive() ?? false;
    },
    async connect(options) {
      const qz = await getQz();
      await configureCallbacks(qz);
      if (qz.websocket.isActive()) return;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await qz.websocket.connect(options);
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          const transientState = /previous disconnect|still closing|connection attempt has not returned/i.test(message);
          if (!transientState || attempt === 2) throw error;
          await new Promise((resolve) => window.setTimeout(resolve, 350));
        }
      }
    },
    async disconnect() {
      const qz = await getQz();
      if (qz.websocket.isActive()) await qz.websocket.disconnect();
    },
    async findPrinters() {
      const qz = await getQz();
      const printers = await qz.printers.find();
      return Array.isArray(printers) ? printers : [];
    },
    async getDefaultPrinter() {
      const qz = await getQz();
      return qz.printers.getDefault();
    },
    async printHtml(printerName, html, jobName) {
      const qz = await getQz();
      if (!qz.websocket.isActive()) throw new Error("QZ Tray esta desconectado.");
      const config = qz.configs.create(printerName, {
        colorType: "grayscale",
        jobName,
        margins: 0,
        scaleContent: true,
        units: "mm",
      });
      await qz.print(config, [{
        type: "pixel",
        format: "html",
        flavor: "plain",
        data: html,
        options: { pageWidth: 80 },
      }]);
    },
  };
}

export function openNativePrintWindow(html: string, title = "DogChef - Impressao") {
  const frame = document.createElement("iframe");
  frame.title = title;
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "1px",
    height: "1px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(frame);
  const printWindow = frame.contentWindow;
  if (!printWindow) {
    frame.remove();
    return false;
  }
  const cleanup = () => window.setTimeout(() => frame.remove(), 500);
  printWindow.addEventListener("afterprint", cleanup, { once: true });
  printWindow.document.open();
  printWindow.document.write(html.replace("</head>", '<meta name="viewport" content="width=device-width, initial-scale=1"></head>'));
  printWindow.document.close();
  printWindow.document.title = title;
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    window.setTimeout(() => frame.remove(), 60_000);
  }, 180);
  return true;
}
