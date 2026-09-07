import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('installed static assets load offline and the Skill download is available', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '每一天，都更进一步。' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  const zip = await page.request.get('./cet4-vocab-coach.zip');
  expect(zip.ok()).toBe(true);
  expect((await zip.body()).subarray(0, 2).toString()).toBe('PK');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '每一天，都更进一步。' })).toBeVisible();
  await page.getByRole('button', { name: '我的词库', exact: true }).click();
  await expect(page.getByRole('heading', { name: '一点一点，积累成词库。' })).toBeVisible();
});

test('desktop navigation, word search, add/edit, self-rated review, and mobile layout', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '每一天，都更进一步。' })).toBeVisible();
  await page.screenshot({
    path: '.tmp/dashboard-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '我的词库', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索单词', exact: true }).fill('后果');
  await expect(page.getByRole('button', { name: 'consequence', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '添加单词', exact: true }).click();
  await page.getByLabel('英文单词', { exact: true }).fill('journey');
  await page.getByLabel('核心词义', { exact: true }).fill('旅程');
  await page.getByRole('button', { name: '保存单词', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: '搜索单词', exact: true }).fill('journey');
  await expect(page.getByRole('button', { name: 'journey', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'journey', exact: true }).click();
  await page.getByLabel('我的笔记', { exact: true }).fill('a long journey');
  await page.getByRole('button', { name: '保存单词', exact: true }).click();
  await page.getByRole('button', { name: '易混词', exact: true }).click();
  await expect(page.getByRole('heading', { name: '相似的词，不同的意思。' })).toBeVisible();
  await page.getByRole('button', { name: '开始易混专项' }).click();
  await page.getByRole('textbox', { name: '它最核心的中文意思是？' }).fill('不知道');
  await page.getByRole('button', { name: '查看答案', exact: true }).click();
  await page.getByRole('button', { name: '记错了', exact: true }).click();
  await expect(page.getByRole('button', { name: '下一个词', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '下一个词', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '它最核心的中文意思是？' })).toHaveValue('');
  await page.getByRole('button', { name: '复习记录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '每一次回想，都记得。' })).toBeVisible();
  for (const [nav, heading] of [
    ['错词本', '记错的地方，正是进步的起点。'],
    ['学习统计', '成长，有迹可循。'],
    ['导入导出', '带进来，也随时带得走。'],
    ['设置', '按自己的节奏，慢慢来。'],
  ]) {
    await page.getByRole('button', { name: nav, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开导航', exact: true }).click();
  await page.getByRole('button', { name: '学习概览', exact: true }).click();
  await expect(page.getByRole('heading', { name: '每一天，都更进一步。' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: '.tmp/dashboard-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});

test('real browser file storage survives reload and rejects external modifications', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: async () => {
        const root = await navigator.storage.getDirectory();
        return root.getDirectoryHandle('CET4-Test', { create: true });
      },
    });
  });
  await page.goto('./');
  await page.getByRole('button', { name: '连接数据目录', exact: true }).click();
  await page.getByRole('button', { name: '选择数据目录', exact: true }).click();
  await expect(page.getByText('本地已连接', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '我的词库', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索单词', exact: true }).fill('affect');
  await page.getByRole('button', { name: 'affect', exact: true }).click();
  await page.getByLabel('我的笔记', { exact: true }).fill('browser note');
  await page.getByRole('button', { name: '保存单词', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const read = () =>
    page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const dir = await (await root.getDirectoryHandle('CET4-Test')).getDirectoryHandle('data');
      return JSON.parse(await (await (await dir.getFileHandle('words.json')).getFile()).text());
    });
  expect((await read()).words.affect.notes).toBe('browser note');
  expect((await read()).revision).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: '连接数据目录', exact: true }).click();
  await page.getByRole('button', { name: '重新连接 CET4-Test', exact: true }).click();
  await expect(page.getByText('本地已连接', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '搜索单词', exact: true }).fill('affect');
  await page.getByRole('button', { name: 'affect', exact: true }).click();
  await expect(page.getByLabel('我的笔记', { exact: true })).toHaveValue('browser note');
  await page.getByLabel('我的笔记', { exact: true }).fill('stale unsaved note');
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const data = await (await root.getDirectoryHandle('CET4-Test')).getDirectoryHandle('data');
    const handle = await data.getFileHandle('words.json');
    const lib = JSON.parse(await (await handle.getFile()).text());
    lib.revision++;
    lib.updated_by = 'codex';
    lib.words.affect.notes = 'external Codex edit';
    const stream = await handle.createWritable();
    await stream.write(JSON.stringify(lib));
    await stream.close();
  });
  await page.getByRole('button', { name: '保存单词', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  expect((await read()).words.affect.notes).toBe('external Codex edit');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('检测到外部修改');
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await page.getByRole('button', { name: 'affect', exact: true }).click();
  await expect(page.getByLabel('我的笔记', { exact: true })).toHaveValue('external Codex edit');
});

test('manual CSV import excludes demo records and archive exports round-trip', async ({ page }) => {
  await page.goto('./#/transfer');
  await page.locator('input[type=file]').setInputFiles({
    name: 'words.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('word,meaning\njourney,旅程\nmaintain,保持'),
  });
  await expect(page.getByRole('dialog')).toContainText('2 个单词');
  await page.getByRole('button', { name: '载入为我的词库' }).click();
  await expect(page.getByText('当前词库 2 个词 · 0 条复习记录', { exact: true })).toBeVisible();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '完整学习存档', exact: false }).click();
  const dl = await event;
  const path = await dl.path();
  const archive = JSON.parse(await readFile(path!, 'utf8'));
  expect(Object.keys(archive.library.words)).toHaveLength(2);
  expect(archive.reviews).toEqual([]);
  expect(archive.format).toBe('cet4-session-v1');
  await page.reload();
  await page.locator('input[type=file]').setInputFiles({
    name: 'session.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole('button', { name: '载入为我的词库' }).click();
  await expect(page.getByText('当前词库 2 个词 · 0 条复习记录', { exact: true })).toBeVisible();
});
