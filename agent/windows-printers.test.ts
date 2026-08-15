import assert from "node:assert/strict";
import test from "node:test";

import { discoverWindowsPrinters, isVirtualWindowsPrinter } from "./windows-printers";

test("ignora filas virtuais por padrao e preserva impressora fisica padrao", () => {
  const printers = discoverWindowsPrinters([
    { name: "Microsoft Print to PDF", isDefault: false, printerStatus: "3" },
    { name: "EPSON TM-T20III", isDefault: true, printerStatus: "3" },
  ]);

  assert.equal(printers.length, 1);
  assert.equal(printers[0]?.name, "EPSON TM-T20III");
  assert.equal(printers[0]?.isDefault, true);
  assert.equal(printers[0]?.transport, "windows-raw");
});

test("permite filas virtuais somente quando solicitadas para diagnostico", () => {
  const records = [{ name: "Microsoft Print to PDF", printerStatus: "3" }];
  assert.equal(isVirtualWindowsPrinter(records[0]!), true);
  assert.equal(discoverWindowsPrinters(records).length, 0);
  assert.equal(discoverWindowsPrinters(records, true).length, 1);
  assert.equal(isVirtualWindowsPrinter({ name: "Fax" }), true);
});

test("informa impressora offline sem remove-la da lista", () => {
  const printers = discoverWindowsPrinters([{ name: "Elgin i9", printerStatus: "7", workOffline: true }]);
  assert.equal(printers[0]?.status, "offline");
});
