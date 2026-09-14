const { _electron: electron } = require('playwright');
const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'folio-ui-'));
  const root = path.join(temp, 'skills');
  await mkdir(path.join(root, 'writing'), { recursive: true });
  await writeFile(path.join(root, 'writing', 'SKILL.md'), '---\nname: friendly-writing\ndescription: Write clear articles from your research notes.\n---\n# Friendly writing\nUse examples and revise.\n<script>window.bad=true</script>');
  let app;
  try {
    app = await electron.launch({ args: [path.resolve(__dirname, '..')], env: { ...process.env, FOLIO_TEST: '1', FOLIO_ROOTS: JSON.stringify([root]), FOLIO_DATA: path.join(temp, 'data') } });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: /friendly writing/i }).first().click();
    await page.getByRole('button', { name: 'Favorite this skill' }).click();
    await page.getByLabel('Personal notes').fill('Keep examples short.');
    await page.getByRole('button', { name: 'Save notes' }).click();
    await page.getByRole('button', { name: 'Run reviews', exact: true }).click();
    await page.getByRole('button', { name: 'Add a review', exact: true }).click();
    await page.getByLabel('Review title').fill('Newsletter first draft');
    await page.getByLabel('What did you change?').fill('Asked for shorter paragraphs twice.');
    await page.getByLabel('Lesson for next time').fill('Specify paragraph length at the start.');
    await page.getByRole('button', { name: 'Save review', exact: true }).click();
    await page.getByText('Newsletter first draft', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Instructions', exact: true }).click();
    await page.locator('pre').getByText('<script>window.bad=true</script>', { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => window.bad), undefined);
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByRole('button', { name: 'Favorites', exact: true }).click();
    await page.getByRole('button', { name: /friendly writing/i }).first().click();
    assert.equal(await page.getByLabel('Personal notes').inputValue(), 'Keep examples short.');
    await page.getByRole('button', { name: 'Run reviews', exact: true }).click();
    await page.getByText('Newsletter first draft', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByPlaceholder('Find a skill or something you want to do…').fill('nonexistent');
    await page.getByText('No books on this shelf yet.', { exact: true }).waitFor();
    await page.getByPlaceholder('Find a skill or something you want to do…').fill('research');
    await page.getByRole('button', { name: /friendly writing/i }).first().waitFor();
    await page.screenshot({ path: path.resolve(__dirname, '../work/ui-test.png') });
    console.log('PASS: Electron browsing, safe source rendering, favorites, notes, reviews, reload persistence, search and dismissal.');
  } finally {
    if (app) await app.close();
    await rm(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
