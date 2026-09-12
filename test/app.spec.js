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

'use strict';

/* global appFunc, windowFunc, checkFileInfo */

const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const carlo = require('../lib/carlo');
const { rpc } = require('../rpc');
const { TestServer } = require('./test_server');

carlo.enterTestMode();

describe('app integration tests', () => {
  let app;
  let server;

  before(async() => {
    server = await TestServer.create(path.join(__dirname, 'http'));
  });

  after(async() => {
    if (server) await server.stop();
  });

  afterEach(async() => {
    if (app) {
      try { await app.exit(); } catch { /* ignore */ }
      app = null;
    }
  });

  function staticHandler(data) {
    return request => {
      for (const entry of data) {
        const url = new URL(request.url());
        if (url.pathname === entry[0]) {
          request.fulfill({ body: Buffer.from(entry[1]), headers: entry[2] });
          return;
        }
      }
      request.continue();
    };
  }

  describe('app basics', () => {
    it('evaluate', async() => {
      app = await carlo.launch();
      const ua = await app.evaluate('navigator.userAgent');
      assert.match(ua, /Chrome/);
    });

    it('exposeFunction', async() => {
      app = await carlo.launch();
      await app.exposeFunction('foobar', () => 42);
      const result = await app.evaluate('foobar()');
      assert.equal(result, 42);
    });

    it('app load', async() => {
      app = await carlo.launch();
      await app.load('data:text/plain,hello');
      const result = await app.evaluate('document.body.textContent');
      assert.equal(result, 'hello');
    });

    it('mainWindow accessor', async() => {
      app = await carlo.launch();
      app.serveFolder(path.join(__dirname, 'folder'));
      await app.load('index.html');
      assert.equal(app.mainWindow().pageForTest().url(), 'https://domain/index.html');
    });

    it('createWindow creates window', async() => {
      app = await carlo.launch();
      let window = await app.createWindow();
      assert.equal(window.pageForTest().url(), 'about:blank?seq=1');
      window = await app.createWindow();
      assert.equal(window.pageForTest().url(), 'about:blank?seq=2');
    });

    it('exit event is emitted', async() => {
      app = await carlo.launch();
      let callback;
      const onexit = new Promise(f => { callback = f; });
      app.on('exit', callback);
      await app.mainWindow().close();
      await onexit;
    });

    it('window event is emitted', async() => {
      app = await carlo.launch();
      const windows = [];
      app.on('window', window => windows.push(window));
      const window1 = await app.createWindow();
      const window2 = await app.createWindow();
      assert.equal(window1, windows[0]);
      assert.equal(window2, windows[1]);
    });

    it('window exposeFunction', async() => {
      app = await carlo.launch();
      await app.exposeFunction('appFunc', () => 'app');
      const w1 = await app.createWindow();
      await w1.exposeFunction('windowFunc', () => 'window');
      const result1 = await w1.evaluate(async() => (await appFunc()) + (await windowFunc()));
      assert.equal(result1, 'appwindow');

      const w2 = await app.createWindow();
      const result2 = await w2.evaluate(async() => (await appFunc()) + self.windowFunc);
      assert.equal(result2, 'appundefined');
    });
  });

  describe('http serve', () => {
    it('serveFolder works', async() => {
      app = await carlo.launch();
      app.serveFolder(path.join(__dirname, 'folder'));
      await app.load('index.html');
      const result = await app.evaluate('document.body.textContent');
      assert.equal(result, 'hello file');
    });

    it('serveFolder prefix is respected works', async() => {
      app = await carlo.launch();
      app.serveFolder(path.join(__dirname, 'folder'), 'prefix');
      await app.load('prefix/index.html');
      const result = await app.evaluate('document.body.textContent');
      assert.equal(result, 'hello file');
    });

    it('serveOrigin works', async() => {
      app = await carlo.launch();
      app.serveOrigin(server.PREFIX);
      await app.load('index.html');
      const result = await app.evaluate('document.body.textContent');
      assert.equal(result, 'hello http');
    });

    it('serveOrigin prefix is respected', async() => {
      app = await carlo.launch();
      app.serveOrigin(server.PREFIX, 'prefix');
      await app.load('prefix/index.html');
      const result = await app.evaluate('document.body.textContent');
      assert.equal(result, 'hello http');
    });

    it('HttpRequest params', async() => {
      app = await carlo.launch();
      app.serveFolder(path.join(__dirname, 'folder'));
      const log = [];
      app.serveHandler(request => {
        log.push({
          url: request.url(),
          method: request.method(),
          ua: Boolean(request.headers()['user-agent'] || request.headers()['User-Agent']),
        });
        request.continue();
      });
      await app.load('index.html');
      assert.equal(log.length, 1);
      assert.equal(log[0].url, 'https://domain/index.html');
      assert.equal(log[0].method, 'GET');
      assert.equal(log[0].ua, true);
    });

    it('serveHandler can fulfill', async() => {
      app = await carlo.launch();
      app.serveHandler(request => {
        if (!request.url().endsWith('index.html')) {
          request.continue();
          return;
        }
        request.fulfill({ body: Buffer.from('hello handler') });
      });
      await app.load('index.html');
      const result = await app.evaluate('document.body.textContent');
      assert.equal(result, 'hello handler');
    });

    it('serveHandler can continue to file', async() => {
      app = await carlo.launch();
      app.serveHandler(request => request.continue());
      app.serveFolder(path.join(__dirname, 'folder'));
      await app.load('index.html');
      const result = await app.evaluate('document.body.textContent');
      assert.equal(result, 'hello file');
    });

    it('serveHandler can continue to http', async() => {
      app = await carlo.launch();
      app.serveOrigin(server.PREFIX);
      app.serveHandler(request => request.continue());
      await app.load('index.html');
      const result = await app.evaluate('document.body.textContent');
      assert.equal(result, 'hello http');
    });

    it('window serveFolder', async() => {
      app = await carlo.launch();

      const w1 = await app.createWindow();
      await w1.serveFolder(path.join(__dirname, 'folder'));
      await w1.load('index.html');
      const result1 = await w1.evaluate('document.body.textContent');
      assert.equal(result1, 'hello file');

      const w2 = await app.createWindow();
      await assert.rejects(
          async() => { await w2.load('index.html'); },
          /domain\/index.html/
      );
    });

    it('navigation history is empty', async() => {
      app = await carlo.launch();
      app.serveFolder(path.join(__dirname, 'folder'));
      await app.load('index.html?1');
      await app.load('index.html?2');
      await app.load('index.html?3');
      assert.equal(await app.evaluate('history.length'), 1);
    });

    it('fail navigation', async() => {
      app = await carlo.launch();
      app.serveFolder(path.join(__dirname, 'folder'));
      app.serveHandler(async request => {
        request.url() === 'https://domain/index.html' ? request.fail() : request.continue();
      });
      await app.load('redirect.html');
      const url = await app.evaluate('window.location.href');
      assert.ok(url.includes('chrome-error') || url.includes('about:blank') || url === 'chrome-error://chromewebdata/');
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
          checkFileInfo(info);
        }
        </script>
        <body><input type="file" id="file"></body>`,
      ]];
      app = await carlo.launch();
      app.serveHandler(staticHandler(files));

      let callback;
      const result = new Promise(f => { callback = f; });
      app.exposeFunction('checkFileInfo', callback);

      await app.load('index.html');
      const page = app.mainWindow().pageForTest();
      const element = await page.evaluateHandle("document.getElementById('file')");
      await element.uploadFile(__filename);
      app.evaluate('check()');
      const info = await result;
      assert.equal(info.path, __filename);
    });
  });

  describe('rpc', () => {
    it('load params are accessible', async() => {
      const files = [[
        '/index.html',
        `<script>async function run() {
           const [a, b] = await carlo.loadParams();
           b.print(await a.val());
         }
         </script>
         <body onload='run()'></body>`,
      ]];
      app = await carlo.launch();
      app.serveHandler(staticHandler(files));
      let callback;
      const result = new Promise(f => { callback = f; });
      await app.load('index.html',
          rpc.handle({ val: 42 }),
          rpc.handle({ print: v => callback(v) }));
      assert.equal(await result, 42);
      await new Promise(f => setTimeout(f, 20));
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
         <body onload='run()'></body>`,
      ]];
      app = await carlo.launch();
      app.serveHandler(staticHandler(files));
      let callback;
      const result = new Promise(f => { callback = f; });
      await app.load('index.html',
          rpc.handle({ val: 42 }),
          rpc.handle({ print: v => callback(v) }));
      assert.equal(await result, 42);
      await new Promise(f => setTimeout(f, 20));
    });
  });
});
