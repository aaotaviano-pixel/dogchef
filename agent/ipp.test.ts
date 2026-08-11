import assert from "node:assert/strict";
import { createServer, type RequestListener } from "node:http";
import test from "node:test";

import { encodeIppRequest, getPrinterAttributesRequest, ippOperations, ippRequest, ippStatusText, parseIppResponse, printJobRequest } from "./ipp";

async function withIppServer(handler: RequestListener, callback: (url: string) => Promise<void>) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Não foi possível abrir o servidor IPP de teste.");
  try {
    await callback(`http://127.0.0.1:${address.port}/p/virtual`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("monta uma requisição IPP com versão, operação e atributos", () => {
  const request = encodeIppRequest(ippOperations.getPrinterAttributes, "http://127.0.0.1:631/printers/test");
  assert.equal(request[0], 0x01);
  assert.equal(request[1], 0x01);
  assert.equal(request.readUInt16BE(2), ippOperations.getPrinterAttributes);
  assert.equal(request[8], 0x01);
  assert.ok(request.includes(Buffer.from("printer-uri")));
});

test("monta Print-Job com documento", () => {
  const request = printJobRequest("http://127.0.0.1:631/printers/test", Buffer.from("DOGCHEF\n"), "text/plain");
  assert.equal(request.readUInt16BE(2), ippOperations.printJob);
  assert.ok(request.includes(Buffer.from("document-format")));
  assert.ok(request.subarray(-8).includes(Buffer.from("DOGCHEF")));
});

test("decodifica status IPP e rejeita resposta curta", () => {
  const response = Buffer.alloc(8);
  response.writeUInt16BE(0x0000, 2);
  response.writeUInt32BE(7, 4);
  assert.deepEqual(parseIppResponse(response), { statusCode: 0, requestId: 7, attributes: Buffer.alloc(0) });
  assert.equal(ippStatusText(0x0404), "client-error-not-found");
  assert.throws(() => parseIppResponse(Buffer.alloc(7)), /incompleta/);
});

test("faz uma requisição IPP real contra um servidor local de teste", async () => {
  let received = Buffer.alloc(0);
  await withIppServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received = Buffer.concat(chunks);
      const payload = Buffer.alloc(8);
      payload.writeUInt16BE(0, 2);
      payload.writeUInt32BE(1, 4);
      response.writeHead(200, { "content-type": "application/ipp" });
      response.end(payload);
    });
  }, async (url) => {
    const result = await ippRequest(url, getPrinterAttributesRequest(url));
    assert.equal(result.statusCode, 0);
    assert.ok(received.includes(Buffer.from("printer-uri")));
  });
});

test("diferencia erro IPP e timeout de conexão", async () => {
  await withIppServer((_request, response) => {
    const payload = Buffer.alloc(8);
    payload.writeUInt16BE(0x0404, 2);
    payload.writeUInt32BE(2, 4);
    response.writeHead(200, { "content-type": "application/ipp" });
    response.end(payload);
  }, async (url) => {
    await assert.rejects(() => ippRequest(url, getPrinterAttributesRequest(url)), /client-error-not-found/);
  });

  await withIppServer((_request, response) => {
    setTimeout(() => response.end(Buffer.alloc(8)), 100);
  }, async (url) => {
    await assert.rejects(() => ippRequest(url, getPrinterAttributesRequest(url), 10), /Tempo limite/);
  });
});
