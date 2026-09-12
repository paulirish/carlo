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

const fs = require('fs');
const path = require('path');
const os = require('os');
const { install, Browser, detectBrowserPlatform } = require('@puppeteer/browsers');

function canAccess(file) {
  if (!file)
    return false;
  try {
    fs.accessSync(file, fs.constants.X_OK || fs.constants.R_OK);
    return true;
  } catch {
    try {
      fs.accessSync(file);
      return true;
    } catch {
      return false;
    }
  }
}

function findLocalBrowserInCache(customDir) {
  let cacheDirs;
  if (customDir) {
    cacheDirs = [customDir];
  } else if (process.env.CARLO_BROWSER_DIR) {
    cacheDirs = [process.env.CARLO_BROWSER_DIR];
  } else {
    cacheDirs = [
      path.join(__dirname, '..', '.local-browser'),
      path.join(os.homedir(), '.cache', 'puppeteer'),
    ];
  }

  for (const cacheDir of cacheDirs) {
    if (!canAccess(cacheDir)) continue;
    const found = searchForExecutable(cacheDir);
    if (found) return found;
  }
  return null;
}

function searchForExecutable(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.endsWith('.app') && process.platform === 'darwin') {
          const macExec = path.join(fullPath, 'Contents', 'MacOS', 'Google Chrome for Testing');
          if (canAccess(macExec)) return macExec;
          const macChromium = path.join(fullPath, 'Contents', 'MacOS', 'Chromium');
          if (canAccess(macChromium)) return macChromium;
          const macChrome = path.join(fullPath, 'Contents', 'MacOS', 'Google Chrome');
          if (canAccess(macChrome)) return macChrome;
        }
        const res = searchForExecutable(fullPath);
        if (res) return res;
      } else if (entry.isFile()) {
        const name = entry.name.toLowerCase();
        if (name === 'chrome' || name === 'chrome.exe' || name === 'chromium' || name === 'chromium.exe')
          if (canAccess(fullPath)) return fullPath;

      }
    }
  } catch {
    // Ignore permissions / read errors in cache search
  }
  return null;
}

function darwin(canary) {
  const paths = canary
    ? [
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    ]
    : [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];

  for (const p of paths)
    if (canAccess(p)) return p;

  return null;
}

function linux(canary) {
  const executables = canary
    ? ['google-chrome-canary', 'google-chrome-unstable']
    : [
      'google-chrome-stable',
      'google-chrome',
      'chromium-browser',
      'chromium',
      'chrome',
    ];

  const systemPaths = [
    '/usr/bin',
    '/usr/local/bin',
    '/snap/bin',
    '/opt/google/chrome',
  ];

  for (const execName of executables) {
    for (const sysPath of systemPaths) {
      const fullPath = path.join(sysPath, execName);
      if (canAccess(fullPath)) return fullPath;
    }
  }

  const desktopFolders = [
    path.join(os.homedir(), '.local', 'share', 'applications'),
    '/usr/share/applications',
  ];

  for (const folder of desktopFolders) {
    if (!canAccess(folder)) continue;
    try {
      const files = fs.readdirSync(folder);
      for (const file of files) {
        if (!file.endsWith('.desktop')) continue;
        const content = fs.readFileSync(path.join(folder, file), 'utf8');
        for (const line of content.split(/\r?\n/)) {
          if (line.startsWith('Exec=')) {
            const execPath = line.substring(5).split(' ')[0].replace(/^"/, '').replace(/"$/, '');
            if ((execPath.includes('chrome') || execPath.includes('chromium')) && canAccess(execPath))
              return execPath;

          }
        }
      }
    } catch {
      // Ignore reading error
    }
  }

  return null;
}

function win32(canary) {
  const suffixes = canary
    ? [`${path.sep}Google${path.sep}Chrome SxS${path.sep}Application${path.sep}chrome.exe`]
    : [
      `${path.sep}Google${path.sep}Chrome${path.sep}Application${path.sep}chrome.exe`,
      `${path.sep}Google${path.sep}Chrome for Testing${path.sep}Application${path.sep}chrome.exe`,
      `${path.sep}Chromium${path.sep}Application${path.sep}chrome.exe`,
    ];

  const prefixes = [
    process.env.LOCALAPPDATA,
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
  ].filter(Boolean);

  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      const chromePath = path.join(prefix, suffix);
      if (canAccess(chromePath)) return chromePath;
    }
  }
  return null;
}

async function downloadBrowser(options, buildId = 'latest') {
  const cacheDir = options.localDataDir || path.join(__dirname, '..', '.local-browser');
  const platform = detectBrowserPlatform();
  if (!platform)
    throw new Error('Could not detect platform for downloading Chrome.');


  const installed = await install({
    browser: Browser.CHROME,
    buildId,
    cacheDir,
    platform,
  });

  return installed.executablePath;
}

async function findChrome(options = {}) {
  if (options.executablePath) {
    const resolvedPath = path.resolve(options.executablePath);
    if (!canAccess(resolvedPath))
      throw new Error(`Specified executablePath does not exist or is not accessible: ${options.executablePath}`);

    return { executablePath: resolvedPath, type: 'user' };
  }

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    const envPath = path.resolve(process.env.PUPPETEER_EXECUTABLE_PATH);
    if (!canAccess(envPath))
      throw new Error(`PUPPETEER_EXECUTABLE_PATH points to non-existent or non-executable file: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);

    return { executablePath: envPath, type: 'env' };
  }

  if (process.env.CHROME_PATH) {
    const envPath = path.resolve(process.env.CHROME_PATH);
    if (!canAccess(envPath))
      throw new Error(`CHROME_PATH points to non-existent or non-executable file: ${process.env.CHROME_PATH}`);

    return { executablePath: envPath, type: 'env' };
  }

  const cachedPath = findLocalBrowserInCache(options.localDataDir);
  if (cachedPath)
    return { executablePath: cachedPath, type: 'cache' };


  const config = new Set(options.channel || ['stable']);
  const platform = options.platform || process.platform;

  let executablePath;
  if (config.has('canary') || config.has('*')) {
    if (platform === 'linux') executablePath = linux(true);
    else if (platform === 'win32') executablePath = win32(true);
    else if (platform === 'darwin') executablePath = darwin(true);

    if (executablePath) return { executablePath, type: 'canary' };
  }

  if (config.has('stable') || config.has('*')) {
    if (platform === 'linux') executablePath = linux(false);
    else if (platform === 'win32') executablePath = win32(false);
    else if (platform === 'darwin') executablePath = darwin(false);

    if (executablePath) return { executablePath, type: 'stable' };
  }

  if (config.has('chromium') || config.has('download')) {
    const downloadedPath = await downloadBrowser(options, 'latest');
    return { executablePath: downloadedPath, type: 'download' };
  }

  for (const item of config) {
    if (item.startsWith('r')) {
      const revision = item.substring(1);
      const downloadedPath = await downloadBrowser(options, revision);
      return { executablePath: downloadedPath, type: 'download' };
    }
  }

  throw new Error(
      'Could not find a compatible Chrome or Chromium browser executable.\n' +
    'Please ensure Chrome is installed locally, set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH, ' +
    'or run "npm run download-browser" to provision a compatible Chrome build.'
  );
}

findChrome.canAccess = canAccess;
findChrome.darwin = darwin;
findChrome.linux = linux;
findChrome.win32 = win32;
findChrome.findLocalBrowserInCache = findLocalBrowserInCache;

module.exports = findChrome;
