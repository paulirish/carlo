/**
 * Copyright 2025 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const findChrome = require('../lib/find_chrome');

describe('findChrome unit tests', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
    delete process.env.CHROME_PATH;
    process.env.CARLO_BROWSER_DIR = path.join(__dirname, 'non-existent-dir-123');
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('respects explicit valid executablePath', async() => {
    const selfPath = __filename;
    const res = await findChrome({ executablePath: selfPath });
    assert.equal(res.executablePath, path.resolve(selfPath));
    assert.equal(res.type, 'user');
  });

  it('throws when explicit executablePath is invalid', async() => {
    const invalidPath = path.join(__dirname, 'non-existent-binary-12345.exe');
    await assert.rejects(
        async() => { await findChrome({ executablePath: invalidPath }); },
        /Specified executablePath does not exist/
    );
  });

  it('respects valid PUPPETEER_EXECUTABLE_PATH env variable', async() => {
    process.env.PUPPETEER_EXECUTABLE_PATH = __filename;
    const res = await findChrome({ localDataDir: path.join(__dirname, 'non-existent-dir-cache') });
    assert.equal(res.executablePath, path.resolve(__filename));
    assert.equal(res.type, 'env');
  });

  it('throws when PUPPETEER_EXECUTABLE_PATH points to invalid file', async() => {
    process.env.PUPPETEER_EXECUTABLE_PATH = path.join(__dirname, 'non-existent-binary.exe');
    await assert.rejects(
        async() => { await findChrome({}); },
        /PUPPETEER_EXECUTABLE_PATH points to non-existent/
    );
  });

  it('respects valid CHROME_PATH env variable', async() => {
    process.env.CHROME_PATH = __filename;
    const res = await findChrome({ localDataDir: path.join(__dirname, 'non-existent-dir-cache') });
    assert.equal(res.executablePath, path.resolve(__filename));
    assert.equal(res.type, 'env');
  });

  it('throws actionable error when no browser is found', async() => {
    const emptyOptions = {
      localDataDir: path.join(__dirname, 'non-existent-empty-folder-12345'),
      channel: ['nonexistentchannel'],
      platform: 'unknown-platform',
    };
    await assert.rejects(
        async() => { await findChrome(emptyOptions); },
        /Could not find a compatible Chrome or Chromium browser executable/
    );
  });
});
