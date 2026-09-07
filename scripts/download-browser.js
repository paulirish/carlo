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

const path = require('path');
const { install, Browser, ChromeReleaseChannel, detectBrowserPlatform, resolveBuildId } = require('@puppeteer/browsers');

async function main() {
  const cacheDir = process.env.CARLO_BROWSER_DIR || path.join(__dirname, '..', '.local-browser');
  const platform = detectBrowserPlatform();
  if (!platform)
    throw new Error('Could not detect platform for browser installation.');


  let buildId = process.env.CARLO_CHROME_BUILD_ID || 'latest';
  if (buildId === 'latest')
    buildId = await resolveBuildId(Browser.CHROME, platform, ChromeReleaseChannel.STABLE);


  console.log(`Installing Chrome (${buildId}) to ${cacheDir}...`);
  const installed = await install({
    browser: Browser.CHROME,
    buildId,
    cacheDir,
    platform,
  });

  console.log(`Chrome successfully installed at: ${installed.executablePath}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Failed to download browser:', err);
    process.exit(1);
  });
}

module.exports = { main };
