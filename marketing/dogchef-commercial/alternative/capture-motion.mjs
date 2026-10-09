#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const ffmpeg = process.env.FFMPEG_BIN || '/home/marcosotaviano/.local/lib/python3.14/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';
const root = path.resolve('marketing/dogchef-commercial/alternative/assets/motion');
const baseUrl = 'https://dogdochef.ddns.net/';
const port = 9556;

await rm(root, {recursive: true, force: true});
await mkdir(root, {recursive: true});

const child = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--hide-scrollbars',
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  `--remote-debugging-port=${port}`,
  '--window-size=780,1688',
  'about:blank',
], {stdio: 'ignore'});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTarget() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
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
const eventHandlers = new Map();

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
    return;
  }
  const handlers = eventHandlers.get(message.method) || [];
  handlers.forEach((handler) => handler(message.params));
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({id, method, params}));
  return new Promise((resolve, reject) => pending.set(id, {resolve, reject}));
}

function on(method, handler) {
  const handlers = eventHandlers.get(method) || [];
  handlers.push(handler);
  eventHandlers.set(method, handlers);
  return () => eventHandlers.set(method, handlers.filter((item) => item !== handler));
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  return result.result?.value;
}

async function waitForReady() {
  process.stdout.write('Aguardando a interface real do site...\n');
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    ready = await evaluate(`Boolean(
      document.querySelector('.dogchef-hero .showcase-slide') &&
      document.querySelector('.category-marquee .category-track') &&
      document.querySelectorAll('.category-tile').length > 4
    )`);
    if (ready) break;
    await sleep(100);
  }
  if (!ready) throw new Error('O banner ou o carrossel não ficou disponível no tempo esperado.');
  await evaluate(`(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    const visibleImages = [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.bottom > -50 && rect.top < innerHeight + 50;
    });
    await Promise.all(visibleImages.map((image) => Promise.race([
      image.decode?.().catch(() => {}) || Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ])));
    return true;
  })()`);
  process.stdout.write('Interface carregada; iniciando capturas em movimento.\n');
}

async function recordClip(name, durationMs, prepareExpression) {
  const directory = path.join(root, name);
  await mkdir(directory, {recursive: true});
  await evaluate(prepareExpression);
  await sleep(350);
  process.stdout.write(`Capturando ${name}...\n`);

  const frames = [];
  let firstTimestamp = null;
  let writing = Promise.resolve();
  const removeHandler = on('Page.screencastFrame', (params) => {
    const timestamp = Number(params.metadata?.timestamp || 0);
    if (firstTimestamp === null) firstTimestamp = timestamp;
    const index = frames.length;
    const filename = `frame-${String(index).padStart(4, '0')}.jpg`;
    frames.push({filename, time: timestamp - firstTimestamp});
    writing = writing.then(() => writeFile(path.join(directory, filename), Buffer.from(params.data, 'base64')));
    send('Page.screencastFrameAck', {sessionId: params.sessionId}).catch(() => undefined);
  });

  await send('Page.startScreencast', {
    format: 'jpeg',
    quality: 94,
    maxWidth: 780,
    maxHeight: 1688,
    everyNthFrame: 1,
  });
  await sleep(durationMs);
  await send('Page.stopScreencast');
  removeHandler();
  await writing;

  if (frames.length < 2) throw new Error(`Captura ${name} sem quadros suficientes.`);
  const fallbackDuration = 1 / 30;
  const concat = frames.map((frame, index) => {
    const next = frames[index + 1];
    const duration = next ? Math.max(1 / 120, next.time - frame.time) : fallbackDuration;
    return `file '${frame.filename}'\nduration ${duration.toFixed(6)}`;
  });
  concat.push(`file '${frames.at(-1).filename}'`);
  await writeFile(path.join(directory, 'frames.txt'), `${concat.join('\n')}\n`);
  await writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify({
    source: baseUrl,
    viewport: {width: 390, height: 844, deviceScaleFactor: 2},
    capturedAt: new Date().toISOString(),
    durationMs,
    frames: frames.length,
    firstTimestamp,
    lastTimestamp: frames.at(-1).time,
  }, null, 2)}\n`);

  await new Promise((resolve, reject) => {
    const encoder = spawn(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', 'frames.txt',
      '-vf', 'fps=60,scale=780:1688:flags=lanczos,unsharp=5:5:0.45:3:3:0.15,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-g', '1', '-keyint_min', '1',
      path.join(root, `${name}-60fps.mp4`),
    ], {cwd: directory, stdio: ['ignore', 'inherit', 'inherit']});
    encoder.once('error', reject);
    encoder.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg encerrou com código ${code}.`)));
  });

  process.stdout.write(`${name}: ${frames.length} quadros reais, ${(frames.at(-1).time).toFixed(2)}s observados.\n`);
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
  await send('Page.navigate', {url: baseUrl});
  await waitForReady();

  await recordClip('hero-carousel', 7600, `(() => {
    window.scrollTo(0, 0);
    const next = [...document.querySelectorAll('button')].find((button) => /próximo destaque/i.test(button.getAttribute('aria-label') || ''));
    window.__dogchefCaptureTimers?.forEach(clearTimeout);
    window.__dogchefCaptureTimers = [
      setTimeout(() => next?.click(), 1250),
      setTimeout(() => next?.click(), 4400),
    ];
    return Boolean(next);
  })()`);

  await recordClip('category-carousel', 6400, `(() => {
    const section = document.querySelector('#cardapio');
    const target = Math.max(0, (section?.getBoundingClientRect().top || 0) + scrollY - 74);
    window.scrollTo({top: target, behavior: 'instant'});
    document.querySelector('.category-carousel')?.classList.remove('is-paused');
    return target;
  })()`);
} finally {
  socket.close();
  child.kill('SIGTERM');
}
