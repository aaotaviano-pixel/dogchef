#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const outputDir = path.resolve('marketing/dogchef-commercial/alternative/assets');
const baseUrl = 'https://dogdochef.ddns.net/';
const port = 9555;

await mkdir(outputDir, {recursive: true});

const child = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--hide-scrollbars',
  '--disable-gpu',
  `--remote-debugging-port=${port}`,
  '--window-size=390,844',
  'about:blank',
], {stdio: 'ignore'});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const target = targets.find((item) => item.type === 'page');
      if (target) return target;
    } catch {}
    await sleep(100);
  }
  throw new Error('Chrome DevTools não respondeu.');
}

const target = await getTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, {once: true});
  socket.addEventListener('error', reject, {once: true});
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const request = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({id, method, params}));
  return new Promise((resolve, reject) => pending.set(id, {resolve, reject}));
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  return result.result?.value;
}

async function navigate(url) {
  await send('Page.navigate', {url});
  await sleep(6500);
  await evaluate(`(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    const images = [...document.images];
    await Promise.all(images.map((image) => image.complete ? true : new Promise((resolve) => {
      image.addEventListener('load', resolve, {once:true});
      image.addEventListener('error', resolve, {once:true});
      setTimeout(resolve, 4500);
    })));
    window.scrollTo(0, 0);
    return true;
  })()`);
  await sleep(400);
}

async function captureViewport(name) {
  const {data} = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(data, 'base64'));
}

async function captureFullPage(name) {
  const metrics = await send('Page.getLayoutMetrics');
  const {width, height} = metrics.cssContentSize;
  const {data} = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip: {x: 0, y: 0, width, height, scale: 1},
  });
  await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(data, 'base64'));
  return {width, height};
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await navigate(baseUrl);

  const palette = await evaluate(`(() => {
    const root = getComputedStyle(document.documentElement);
    const read = (name) => root.getPropertyValue(name).trim();
    return {
      red: read('--store-red') || read('--brand-red'),
      redBright: read('--store-red-bright') || read('--brand-red'),
      mustard: read('--store-mustard') || read('--brand-mustard'),
      ink: read('--store-ink') || read('--brand-grill'),
      charcoal: read('--store-charcoal'),
      cream: read('--store-cream') || read('--brand-cream'),
      paper: read('--store-paper'),
      line: read('--store-line'),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
    };
  })()`);

  const anchors = await evaluate(`(() => {
    const section = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return Math.round(rect.top + scrollY);
    };
    return {
      cardapio: section('#cardapio'),
      destaques: section('#destaques'),
      sobre: section('#sobre'),
      documentHeight: document.documentElement.scrollHeight,
    };
  })()`);

  await evaluate(`(async () => {
    const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    for (let top = 0; top <= maximum; top += Math.round(innerHeight * .72)) {
      window.scrollTo(0, top);
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    window.scrollTo(0, maximum);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const images = [...document.images];
    await Promise.all(images.map((image) => image.complete ? true : new Promise((resolve) => {
      image.addEventListener('load', resolve, {once:true});
      image.addEventListener('error', resolve, {once:true});
      setTimeout(resolve, 3500);
    })));
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 350));
    return true;
  })()`);

  const fullPage = await captureFullPage('site-mobile-full');
  const resolvedAnchors = await evaluate(`(() => {
    const section = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return Math.round(rect.top + scrollY);
    };
    return {
      cardapio: section('#cardapio'),
      destaques: section('#destaques'),
      sobre: section('#sobre'),
      documentHeight: document.documentElement.scrollHeight,
    };
  })()`);
  await captureViewport('site-mobile-home');

  await evaluate(`window.scrollTo({top: Math.max(0, (${resolvedAnchors.destaques ?? anchors.destaques ?? 0}) - 78), behavior:'instant'}); true`);
  await sleep(300);
  await captureViewport('site-mobile-highlights');

  await evaluate(`window.scrollTo({top: Math.max(0, (${resolvedAnchors.sobre ?? anchors.sobre ?? 0}) - 78), behavior:'instant'}); true`);
  await sleep(350);
  await captureViewport('site-mobile-about');

  const aboutText = await evaluate(`(() => {
    const element = document.querySelector('#sobre');
    return element?.innerText?.replace(/\\s+/g, ' ').trim() || '';
  })()`);

  await navigate(baseUrl);
  const productOpened = await evaluate(`(() => {
    const image = [...document.images].find((item) => /Combo do Chef/i.test(item.alt || ''));
    const button = image?.closest('button') || image?.closest('[role="button"]');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  await sleep(450);
  await captureViewport('site-mobile-product');

  const added = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => /Adicionar ao carrinho/i.test(item.textContent || ''));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  await sleep(400);

  const cartOpened = await evaluate(`(() => {
    const buttons = [...document.querySelectorAll('button')];
    const button = buttons.find((item) => /1 item/i.test(item.textContent || ''))
      || buttons.find((item) => /carrinho/i.test(item.getAttribute('aria-label') || ''));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  await sleep(450);
  await captureViewport('site-mobile-cart');

  const manifest = {
    capturedAt: new Date().toISOString(),
    source: baseUrl,
    viewport: {width: 390, height: 844, deviceScaleFactor: 2},
    fullPage,
    palette,
    anchors: resolvedAnchors,
    verifiedFlow: {productOpened, added, cartOpened},
    files: [
      'site-mobile-full.png',
      'site-mobile-home.png',
      'site-mobile-highlights.png',
      'site-mobile-about.png',
      'site-mobile-product.png',
      'site-mobile-cart.png',
    ],
    aboutText,
    safety: 'A captura adicionou um item apenas ao carrinho local do navegador e parou antes de login, pedido ou pagamento.',
  };
  await writeFile(path.join(outputDir, 'capture-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  socket.close();
  child.kill('SIGTERM');
}
