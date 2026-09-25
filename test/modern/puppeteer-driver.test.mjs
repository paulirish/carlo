import {afterEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Browser, computeExecutablePath, detectBrowserPlatform} from '@puppeteer/browsers';
import {CHROME_BUILD_ID} from '../../dist/internal/browser-build.js';

let running;
let ownedPid;
let ownedProfile;

async function assertProcessExited(pid) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      assert.equal(error.code, 'ESRCH');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail(`owned Chrome process ${pid} leaked`);
}

afterEach(async() => {
  let cleanupFailure;
  try {
    if (running !== undefined) await running.close();
  } catch (error) {
    cleanupFailure = error;
  }
  try {
    if (ownedPid !== undefined)
      await assertProcessExited(ownedPid);
    if (ownedProfile !== undefined)
      await assert.rejects(access(ownedProfile), {code: 'ENOENT'}, `temporary profile ${ownedProfile} leaked`);
    if (cleanupFailure !== undefined) throw cleanupFailure;
  } finally {
    running = undefined;
    ownedPid = undefined;
    ownedProfile = undefined;
  }
}, {timeout: 20_000});

test('Puppeteer task driver launches pinned Chrome', {timeout: 30_000}, async t => {
  const cacheDir = process.env.CARLO_BROWSER_DIR || path.resolve('.local-browser');
  const executablePath = computeExecutablePath({browser: Browser.CHROME, buildId: CHROME_BUILD_ID, cacheDir, platform: detectBrowserPlatform()});
  if (!fs.existsSync(executablePath)) return t.skip('run npm run download-browser to provision pinned Chrome');
  const launchArgs = process.platform === 'linux' && process.env.GITHUB_ACTIONS === 'true' ?
    ['--no-sandbox', '--disable-setuid-sandbox'] : undefined;
  const [{launchWithDriver}, {PuppeteerChromeDriver}] = await Promise.all([
    import(pathToFileURL(path.resolve('dist/internal/launcher.js'))),
    import(pathToFileURL(path.resolve('dist/internal/puppeteer-driver.js'))),
  ]);
  const fixture = pathToFileURL(path.resolve('test/fixtures/packed-consumer/index.html'));
  running = await launchWithDriver(new PuppeteerChromeDriver(), {
    entry: fixture,
    request: {...(launchArgs === undefined ? {} : {launchArgs}), headless: true, executablePath, startupTimeoutMs: 15_000},
    startupTimeoutMs: 15_000,
    navigationTimeoutMs: 15_000,
    shutdownTimeoutMs: 10_000,
  });
  ownedPid = running.processId;
  ownedProfile = running.profilePath;
});
