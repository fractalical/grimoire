import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';

let proxy: Server;
let proxyURL: string;

test.beforeAll(async ({ baseURL }) => {
  // Reproduce a public proxy that blocks node_modules and hidden directories.
  proxy = createServer((req, res) => {
    const target = new URL(req.url ?? '/', baseURL);
    if (target.pathname.split('/').some(part => part === 'node_modules' || part.startsWith('.'))) {
      res.writeHead(404).end('Not Found');
      return;
    }
    const upstream = httpRequest(target, {
      method: req.method,
      headers: { ...req.headers, host: target.host },
    }, response => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => res.writeHead(502).end('Bad Gateway'));
    req.pipe(upstream);
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  proxyURL = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  proxy?.closeAllConnections();
  if (proxy) await new Promise<void>((resolve, reject) => proxy.close(error => error ? reject(error) : resolve()));
});

test('published app loads through a proxy and preserves the current question on reload', async ({ page }, testInfo) => {
  const failedResponses: string[] = [];
  const errors: string[] = [];
  const requestedPaths: string[] = [];
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requestedPaths.push(new URL(request.url()).pathname));
  await page.goto(proxyURL);
  await expect(page.getByRole('heading', { name: 'Твоё приключение' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('published-map.png'), fullPage: true });
  await page.getByRole('button', { name: 'Начать приключение' }).click();
  await expect(page.locator('#question-title')).toBeVisible();
  const question = await page.locator('#question-title').textContent();
  await page.reload();
  await expect(page.locator('#question-title')).toHaveText(question!);
  await page.screenshot({ path: testInfo.outputPath('published-question.png'), fullPage: true });
  expect(failedResponses).toEqual([]);
  expect(errors).toEqual([]);
  expect(requestedPaths.some(path => path.startsWith('/node_modules/') || path.startsWith('/@vite/'))).toBe(false);
});

test('static server accepts the public Host and returns 404 for unavailable files', async ({ request, baseURL }) => {
  const home = await request.get(baseURL!, { headers: { Host: 'grimoire.example.test' } });
  expect(home.status()).toBe(200);
  expect(await home.text()).toContain('id="root"');
  for (const path of ['/assets/missing.js', '/src/main.tsx', '/package.json', '/.env.local']) {
    const response = await request.get(new URL(path, baseURL).href);
    expect(response.status(), path).toBe(404);
  }
});
