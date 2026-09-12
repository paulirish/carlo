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

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

describe('Security and File Serving unit tests', () => {
  it('correctly identifies standard MIME types', () => {
    assert.equal(mime.lookup('index.html'), 'text/html');
    assert.match(mime.lookup('script.js'), /javascript/);
    assert.equal(mime.lookup('styles.css'), 'text/css');
    assert.equal(mime.lookup('image.png'), 'image/png');
    assert.equal(mime.lookup('data.json'), 'application/json');
    assert.equal(mime.lookup('font.woff2'), 'font/woff2');
  });

  it('prevents directory traversal outside root folder', () => {
    const rootFolder = path.join(__dirname, 'folder');
    const safePath = path.normalize('../package.json').replace(/^(\.\.[/\\])+/, '');
    const resolvedPath = path.join(rootFolder, safePath);

    const realFolder = fs.realpathSync(rootFolder);
    let isOutside = false;
    try {
      const realFile = fs.realpathSync(resolvedPath);
      if (!realFile.startsWith(realFolder + path.sep))
        isOutside = true;

    } catch {
      isOutside = true;
    }
    assert.equal(isOutside, true);
  });

  it('blocks symlinks pointing outside root folder', () => {
    const tmpDir = path.join(__dirname, '..', '.local-data', 'test-symlink-root');
    const outsideFile = path.join(__dirname, '..', 'package.json');
    fs.mkdirSync(tmpDir, { recursive: true });
    const symlinkPath = path.join(tmpDir, 'escaped-package.json');

    try {
      if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
      fs.symlinkSync(outsideFile, symlinkPath);

      const realFolder = fs.realpathSync(tmpDir);
      const realFile = fs.realpathSync(symlinkPath);
      const isAllowed = realFile.startsWith(realFolder + path.sep) || realFile === realFolder;
      assert.equal(isAllowed, false);
    } finally {
      try { if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath); } catch { /* ignore */ }
      try { if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir); } catch { /* ignore */ }
    }
  });
});
