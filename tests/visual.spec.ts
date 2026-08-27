import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

type CanvasSample = {
  ok: boolean;
  reason: string;
  variance?: number;
  colorBuckets?: number;
};

async function sampleCanvas(page: import('@playwright/test').Page): Promise<CanvasSample> {
  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  if (!box || box.width < 32 || box.height < 32) return { ok: false, reason: 'canvas-too-small' };

  const buffer = await canvas.screenshot();
  const png = PNG.sync.read(buffer);
  let min = 255;
  let max = 0;
  let alphaPixels = 0;
  const buckets = new Set<string>();
  const stride = Math.max(1, Math.floor((png.width * png.height) / 4096));

  for (let pixel = 0; pixel < png.width * png.height; pixel += stride) {
    const offset = pixel * 4;
    const r = png.data[offset];
    const g = png.data[offset + 1];
    const b = png.data[offset + 2];
    const a = png.data[offset + 3];
    min = Math.min(min, r, g, b);
    max = Math.max(max, r, g, b);
    if (a > 0) alphaPixels += 1;
    buckets.add(`${r >> 4},${g >> 4},${b >> 4},${a >> 6}`);
  }

  const variance = max - min;
  return { ok: alphaPixels > 256 && (variance > 8 || buckets.size > 3), reason: 'sampled', variance, colorBuckets: buckets.size };
}

async function cellPosition(page: import('@playwright/test').Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const position = await page.evaluate(({ x: cellX, y: cellY }) => window.__THREE_GAME_TEST_HOOKS__?.getCellScreenPosition({ x: cellX, y: cellY }), { x, y });
  expect(position, `screen position should exist for cell ${x},${y}`).not.toBeNull();
  return position as { x: number; y: number };
}

test('renders a nonblank interactive Cờ Thú board', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(page.locator('#turn-value')).toHaveText('ĐỎ');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);

  const sample = await sampleCanvas(page);
  expect(sample, JSON.stringify(sample)).toMatchObject({ ok: true });

  const piece = await cellPosition(page, 0, 0);
  const destination = await cellPosition(page, 0, 1);
  if (testInfo.project.name.includes('mobile')) await page.touchscreen.tap(piece.x, piece.y);
  else await page.mouse.click(piece.x, piece.y);
  await expect(page.locator('#selection-info')).toContainText('nước hợp lệ');
  if (testInfo.project.name.includes('mobile')) await page.touchscreen.tap(destination.x, destination.y);
  else await page.mouse.click(destination.x, destination.y);
  await expect
    .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.score ?? 0))
    .toBeGreaterThan(0);

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(`${testInfo.project.name}-co-thu`, { body: screenshot, contentType: 'image/png' });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('rules modal and local mode are usable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Luật chơi' }).click();
  await expect(page.locator('#rules-modal')).toBeVisible();
  await expect(page.locator('#rules-title')).toHaveText('Cách chơi Cờ Thú');
  await page.getByRole('button', { name: 'Đóng luật chơi' }).click();
  await expect(page.locator('#rules-modal')).toBeHidden();

  await page.getByRole('button', { name: 'Đấu với Bot' }).click();
  await expect(page.getByRole('button', { name: 'Hai người chơi' })).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.mode))
    .toBe('local');
});
