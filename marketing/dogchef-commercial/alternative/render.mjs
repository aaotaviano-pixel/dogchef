#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) => [
  value.replace(/^--/, ''),
  all[index + 1] && !all[index + 1].startsWith('--') ? all[index + 1] : true,
]));
const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const sourceFps = 30;
const outputFps = Number(args.fps || 30);
const width = Number(args.width || 540);
const height = Number(args.height || 960);
const duration = Number(args.duration || 45);
const start = Number(args.start || 0);
const defaultPreviewUrl = pathToFileURL(path.resolve('marketing/dogchef-commercial/alternative/index.html')).href;
const serverUrl = String(args.url || defaultPreviewUrl);
const outputDir = path.resolve(String(args.out || 'marketing/dogchef-commercial/alternative/output/frames'));
const port = Number(args.port || 9666);
const totalFrames = Math.round(duration * outputFps);

await rm(outputDir, {recursive: true, force: true});
await mkdir(outputDir, {recursive: true});

const child = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--hide-scrollbars', '--use-angle=swiftshader',
  '--run-all-compositor-stages-before-draw',
  `--remote-debugging-port=${port}`, `--window-size=${width},${height}`, 'about:blank',
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
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Falha ao avaliar a composição.';
    throw new Error(description);
  }
  return result;
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: true});
  await send('Page.navigate', {url: `${serverUrl}?capture=1&frame=${Math.round(start * sourceFps)}`});
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const state = await evaluate(`Boolean(document.querySelector('#stage') && window.renderDogChefAlternativeFrame)`);
      if (state.result?.value) {
        ready = true;
        break;
      }
    } catch {}
    await sleep(100);
  }
  if (!ready) throw new Error(`A prévia não carregou em ${serverUrl}. Verifique os recursos locais antes de renderizar.`);
  await evaluate(`(async()=>{
    if(document.fonts?.ready)await document.fonts.ready;
    await Promise.all([...document.images].map((image)=>image.decode?.().catch(()=>{})||true));
    await Promise.all([...document.querySelectorAll('video')].map((video)=>video.readyState>=2?true:new Promise((resolve)=>{
      const finish=()=>resolve(true);
      video.addEventListener('loadeddata',finish,{once:true});
      setTimeout(finish,5000);
    })));
    return true;
  })()`);
  const scale = width / 1080;
  await evaluate(`document.querySelector('#stage').style.transform='scale(${scale})';document.querySelector('#stage').style.transformOrigin='top left';document.body.style.overflow='hidden';true`);
  await evaluate(`window.renderDogChefAlternativeFrame(${Math.round(start * sourceFps)})`);
  await sleep(500);

  for (let index = 0; index < totalFrames; index += 1) {
    const sourceFrame = Math.round((start + index / outputFps) * sourceFps);
    await evaluate(`window.renderDogChefAlternativeFrame(${sourceFrame})`);
    await sleep(34);
    const {data} = await send('Page.captureScreenshot', {format: 'jpeg', quality: 90, fromSurface: true, captureBeyondViewport: false});
    await writeFile(path.join(outputDir, `frame-${String(index).padStart(4, '0')}.jpg`), Buffer.from(data, 'base64'));
    if (index % outputFps === 0) process.stdout.write(`render ${index / outputFps}s / ${duration}s\n`);
  }
  await writeFile(path.join(outputDir, 'render.json'), `${JSON.stringify({width, height, outputFps, sourceFps, start, duration, totalFrames, serverUrl}, null, 2)}\n`);
} finally {
  socket.close();
  child.kill('SIGTERM');
}
