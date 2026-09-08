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
const { rpc } = require('../rpc');

carlo.enterTestMode();

let app;

function staticHandler(data) {
  return request => {
    for (const entry of data) {
      const url = new URL(request.url());
      if (url.pathname === entry[0]) {
        request.fulfill({ body: Buffer.from(entry[1]), headers: entry[2]});
        return;
      }
    }
    request.continue();
  };
}

afterEach(async() => {
  if (app) {
    try { await app.exit(); } catch (e) {}
    app = null;
  }
});

describe('app basics', () => {
  it('evaluate', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    const ua = await app.evaluate('navigator.userAgent');
    assert.match(ua, /HeadlessChrome/);
  });

  it('exposeFunction', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    await app.exposeFunction('foobar', () => 42);
    const result = await app.evaluate('foobar()');
    assert.strictEqual(result, 42);
  });

  it('app load', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    await app.load('data:text/plain,hello');
    const result = await app.evaluate('document.body.textContent');
    assert.strictEqual(result, 'hello');
  });

  it('mainWindow accessor', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    app.serveFolder(path.join(__dirname, 'folder'));
    await app.load('index.html');
    assert.strictEqual(app.mainWindow().pageForTest().url(), 'https://domain/index.html');
  });

  it('createWindow creates window', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    let window = await app.createWindow();
    assert.strictEqual(window.pageForTest().url(), 'about:blank?seq=1');
    window = await app.createWindow();
    assert.strictEqual(window.pageForTest().url(), 'about:blank?seq=2');
  });

  it('exit event is emitted', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    const onexit = new Promise(f => app.on('exit', f));
    await app.mainWindow().close();
    await onexit;
  });

  it('window event is emitted', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    const windows = [];
    app.on('window', window => windows.push(window));
    const window1 = await app.createWindow();
    const window2 = await app.createWindow();
    assert.strictEqual(window1, windows[0]);
    assert.strictEqual(window2, windows[1]);
  });

  it('window exposeFunction', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    await app.exposeFunction('appFunc', () => 'app');
    const w1 = await app.createWindow();
    await w1.exposeFunction('windowFunc', () => 'window');
    const result1 = await w1.evaluate(async() => (await appFunc()) + (await windowFunc()));
    assert.strictEqual(result1, 'appwindow');

    const w2 = await app.createWindow();
    const result2 = await w2.evaluate(async() => (await appFunc()) + self.windowFunc);
    assert.strictEqual(result2, 'appundefined');
  });

  it('custom window bounds and screenshot verification', async() => {
    app = await carlo.launch({ width: 600, height: 400, args: ['--no-sandbox'] });
    app.serveFolder(path.join(__dirname, 'folder'));
    await app.load('index.html');
    const mainWindow = app.mainWindow();
    assert.ok(mainWindow);

    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir))
      fs.mkdirSync(screenshotDir, { recursive: true });

    const screenshotPath = path.join(screenshotDir, 'app_window.png');
    await mainWindow.pageForTest().screenshot({ path: screenshotPath });
    assert.ok(fs.existsSync(screenshotPath));
    assert.ok(fs.statSync(screenshotPath).size > 0);
  });
});

describe('http serve', () => {
  it('serveFolder works', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    app.serveFolder(path.join(__dirname, 'folder'));
    await app.load('index.html');
    const result = await app.evaluate('document.body.textContent');
    assert.strictEqual(result, 'hello file');
  });

  it('serveFolder prefix is respected works', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    app.serveFolder(path.join(__dirname, 'folder'), 'prefix');
    await app.load('prefix/index.html');
    const result = await app.evaluate('document.body.textContent');
    assert.strictEqual(result, 'hello file');
  });

  it('HttpRequest params', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    app.serveFolder(path.join(__dirname, 'folder'));
    const log = [];
    app.serveHandler(request => {
      log.push({url: request.url(), method: request.method(), ua: ('user-agent' in request.headers()) || ('User-Agent' in request.headers()) });
      request.continue();
    });
    await app.load('index.html');
    assert.strictEqual(JSON.stringify(log), '[{"url":"https://domain/index.html","method":"GET","ua":true}]');
  });

  it('serveHandler can fulfill', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    app.serveHandler(request => {
      if (!request.url().endsWith('index.html')) {
        request.continue();
        return;
      }
      request.fulfill({ body: Buffer.from('hello handler') });
    });
    await app.load('index.html');
    const result = await app.evaluate('document.body.textContent');
    assert.strictEqual(result, 'hello handler');
  });

  it('serveHandler can continue to file', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    app.serveHandler(request => request.continue());
    app.serveFolder(path.join(__dirname, 'folder'));
    await app.load('index.html');
    const result = await app.evaluate('document.body.textContent');
    assert.strictEqual(result, 'hello file');
  });

  it('window serveFolder', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });

    const w1 = await app.createWindow();
    await w1.serveFolder(path.join(__dirname, 'folder'));
    await w1.load('index.html');
    const result1 = await w1.evaluate('document.body.textContent');
    assert.strictEqual(result1, 'hello file');

    const w2 = await app.createWindow();
    await assert.rejects(async() => {
      await w2.load('index.html');
    }, /domain\/index.html/);
  });

  it('navigation history is empty', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    app.serveFolder(path.join(__dirname, 'folder'));
    await app.load('index.html?1');
    await app.load('index.html?2');
    await app.load('index.html?3');
    assert.strictEqual(await app.evaluate('history.length'), 1);
  });

  it('fail navigation', async() => {
    app = await carlo.launch({ args: ['--no-sandbox'] });
    app.serveFolder(path.join(__dirname, 'folder'));
    app.serveHandler(async request => {
      request.url() === 'https://domain/index.html' ? request.fail() : request.continue();
    });
    await app.load('redirect.html');
    assert.strictEqual(await app.evaluate(`window.location.href`), 'chrome-error://chromewebdata/');
  });
});

describe('features', () => {
  it('carlo.fileInfo', async() => {
    const files = [[
      '/index.html', `
      <script>
      async function check() {
        const input = document.getElementById('file');
        const info = await self.carlo.fileInfo(input.files[0]);
        window.checkFileInfo(info);
      }
      </script>
      <body><input type="file" id="file"></body>`
    ]];
    app = await carlo.launch({ args: ['--no-sandbox'] });
    app.serveHandler(staticHandler(files));

    let callback;
    const result = new Promise(f => callback = f);
    app.exposeFunction('checkFileInfo', callback);

    await app.load('index.html');
    const page = app.mainWindow().pageForTest();
    const element = await page.evaluateHandle(`document.getElementById('file')`);
    await element.uploadFile(__filename);
    app.evaluate('check()');
    const info = await result;
    assert.strictEqual(info.path, __filename);
  });
});

describe('rpc integration', () => {
  it('load params are accessible', async() => {
    const files = [[
      '/index.html',
      `<script>async function run() {
         const [a, b] = await carlo.loadParams();
         b.print(await a.val());
       }
       </script>
       <body onload='run()'></body>`
    ]];
    app = await carlo.launch({ args: ['--no-sandbox'] });
    app.serveHandler(staticHandler(files));
    let callback;
    const result = new Promise(f => callback = f);
    await app.load('index.html',
        rpc.handle({ val: 42 }),
        rpc.handle({ print: v => callback(v) }));
    assert.strictEqual(await result, 42);
    await new Promise(f => setTimeout(f, 0));
  });

  it('load params are accessible after reload', async() => {
    const files = [[
      '/index.html',
      `<script>async function run() {
         if (!window.location.search) {
           setTimeout(() => {
             window.location.href += '?reload';
           }, 0);
           return;
         }
         const [a, b] = await carlo.loadParams();
         b.print(await a.val());
       }
       </script>
       <body onload='run()'></body>`
    ]];
    app = await carlo.launch({ args: ['--no-sandbox'] });
    app.serveHandler(staticHandler(files));
    let callback;
    const result = new Promise(f => callback = f);
    await app.load('index.html',
        rpc.handle({ val: 42 }),
        rpc.handle({ print: v => callback(v) }));
    assert.strictEqual(await result, 42);
    await new Promise(f => setTimeout(f, 0));
  });
});
