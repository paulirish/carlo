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

const http = require('http');
const path = require('path');
const fs = require('fs');

class TestServer {
  static async create(assetsFolder) {
    const server = http.createServer((req, res) => {
      const pathname = new URL(req.url, 'http://127.0.0.1/').pathname;
      const file = path.join(assetsFolder, pathname.substring(1) || 'index.html');
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(file));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    return {
      PORT: port,
      PREFIX: `http://127.0.0.1:${port}`,
      stop: () => new Promise(f => server.close(f)),
      reset: () => {},
    };
  }
}

module.exports = { TestServer };
