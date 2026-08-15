import assert from "node:assert/strict";
import test from "node:test";

import { preferredPrinterId } from "./printers";

test("prefere a impressora padrao informada pelo Windows", () => {
  const selected = preferredPrinterId([
    { id: "cozinha", name: "Impressora da cozinha", source: "windows" },
    { id: "balcao", name: "Impressora do balcao", source: "windows", isDefault: true },
  ]);

  assert.equal(selected, "balcao");
});

test("mantem a primeira impressora quando o Windows nao informou uma padrao", () => {
  assert.equal(preferredPrinterId([{ id: "cozinha", name: "Impressora da cozinha" }]), "cozinha");
});
