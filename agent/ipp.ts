export type IppAttribute = {
  tag: number;
  name: string;
  value: string;
};

export type IppResponse = {
  statusCode: number;
  requestId: number;
  attributes: Uint8Array;
};

const IPP_VERSION = [0x01, 0x01];
const OP_GET_PRINTER_ATTRIBUTES = 0x000b;
const OP_PRINT_JOB = 0x0002;

function uint16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16BE(value, 0);
  return buffer;
}

function uint32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value, 0);
  return buffer;
}

function attribute(attribute: IppAttribute) {
  const name = Buffer.from(attribute.name, "utf8");
  const value = Buffer.from(attribute.value, "utf8");
  return Buffer.concat([Buffer.from([attribute.tag]), uint16(name.length), name, uint16(value.length), value]);
}

export function encodeIppRequest(operationId: number, printerUri: string, document?: Uint8Array, documentFormat = "application/octet-stream") {
  const operationAttributes: IppAttribute[] = [
    { tag: 0x47, name: "attributes-charset", value: "utf-8" },
    { tag: 0x48, name: "attributes-natural-language", value: "pt-br" },
    { tag: 0x45, name: "printer-uri", value: printerUri },
    { tag: 0x42, name: "requesting-user-name", value: "dogchef" },
  ];
  if (operationId === OP_PRINT_JOB) operationAttributes.push({ tag: 0x49, name: "document-format", value: documentFormat });
  const request = Buffer.concat([
    Buffer.from(IPP_VERSION),
    uint16(operationId),
    uint32(1),
    Buffer.from([0x01]),
    ...operationAttributes.map(attribute),
    Buffer.from([0x03]),
    document ? Buffer.from(document) : Buffer.alloc(0),
  ]);
  return request;
}

export function parseIppResponse(input: Uint8Array): IppResponse {
  const response = Buffer.from(input);
  if (response.length < 8) throw new Error("Resposta IPP incompleta.");
  const statusCode = response.readUInt16BE(2);
  const requestId = response.readUInt32BE(4);
  return { statusCode, requestId, attributes: response.subarray(8) };
}

export function ippStatusText(statusCode: number) {
  const known: Record<number, string> = {
    0x0000: "successful-ok",
    0x0001: "successful-ok-ignored-or-substituted-attributes",
    0x0400: "client-error-bad-request",
    0x0404: "client-error-not-found",
    0x0500: "server-error-internal-error",
  };
  return known[statusCode] ?? `status-0x${statusCode.toString(16).padStart(4, "0")}`;
}

export function getPrinterAttributesRequest(printerUri: string) {
  return encodeIppRequest(OP_GET_PRINTER_ATTRIBUTES, printerUri);
}

export function printJobRequest(printerUri: string, document: Uint8Array, documentFormat: string) {
  return encodeIppRequest(OP_PRINT_JOB, printerUri, document, documentFormat);
}

export async function ippRequest(uri: string, body: Uint8Array, timeoutMs = 8_000) {
  let response: Response;
  try {
    response = await fetch(uri, {
      method: "POST",
      headers: { Accept: "application/ipp", "Content-Type": "application/ipp" },
      body: Buffer.from(body) as unknown as BodyInit,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    if (name === "TimeoutError" || name === "AbortError") throw new Error("Tempo limite ao conectar à impressora IPP.");
    throw error;
  }
  const payload = await response.arrayBuffer();
  if (!response.ok) throw new Error(`HTTP ${response.status} ao falar com a impressora IPP.`);
  const parsed = parseIppResponse(new Uint8Array(payload));
  if (parsed.statusCode >= 0x0400) throw new Error(`IPP ${ippStatusText(parsed.statusCode)}.`);
  return parsed;
}

export const ippOperations = { getPrinterAttributes: OP_GET_PRINTER_ATTRIBUTES, printJob: OP_PRINT_JOB } as const;
