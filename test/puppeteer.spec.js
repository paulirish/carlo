/**
 * Copyright 2018 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const carlo = require('../lib/carlo');

carlo.enterTestMode();

let app;

afterEach(async() => {
  if (app) {
    try { await app.exit(); } catch (e) {}
    app = null;
  }
});

describe('puppeteer & screenshot tests', () => {
  it('puppeteer browser and page access', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    const browser = app.browserForTest();
    assert.ok(browser);

    const page = app.mainWindow().pageForTest();
    assert.ok(page);

    const title = await page.title();
    assert.strictEqual(typeof title, 'string');
  });

  it('page screenshot capture', async() => {
    app = await carlo.launch({ width: 800, height: 600, args: ['--no-sandbox'] });
    const page = app.mainWindow().pageForTest();
    await page.evaluate(() => {
      document.body.innerHTML = '<h1 id="title" style="color: blue;">Carlo Puppeteer Test</h1>';
    });

    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir))
      fs.mkdirSync(screenshotDir, { recursive: true });

    const screenshotPath = path.join(screenshotDir, 'puppeteer_test.png');
    await page.screenshot({ path: screenshotPath });

    assert.ok(fs.existsSync(screenshotPath));
    assert.ok(fs.statSync(screenshotPath).size > 0);
  });
});
