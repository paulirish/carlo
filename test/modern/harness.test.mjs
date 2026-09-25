import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve, sep} from 'node:path';

const dist = pathToFileURL(resolve('dist/internal') + sep);
async function modules() {
  return Promise.all([
    import(new URL('launcher.js', dist)),
    import(new URL('scripted-driver.js', dist)),
  ]);
}
const options = {
  entry: new URL('file:///fixture/index.html'),
  request: {headless: true, startupTimeoutMs: 30},
  startupTimeoutMs: 30,
  navigationTimeoutMs: 30,
  shutdownTimeoutMs: 30,
};

test('scripted adapter preserves ordering', async() => {
  const [{launchWithDriver}, {ScriptedChromeDriver}] = await modules();
  const driver = new ScriptedChromeDriver();
  const app = await launchWithDriver(driver, options);
  await app.close();
  assert.deepEqual(driver.calls, ['launch', 'navigate', 'bridge', 'close']);
});

test('launch failures retain their cause and clean up promptly', async() => {
  const [{launchWithDriver}, {ScriptedChromeDriver}] = await modules();
  const cause = new Error('no chrome');
  const driver = new ScriptedChromeDriver({launch: {fail: cause}});
  await assert.rejects(launchWithDriver(driver, options), error =>
    error.code === 'ERR_BROWSER_LAUNCH_FAILED' && error.cause === cause);
});

test('disconnect wins an ordering race', async() => {
  const [{launchWithDriver}, {ScriptedChromeDriver}] = await modules();
  const driver = new ScriptedChromeDriver({navigate: 'hang', disconnectAt: 'navigate'});
  await assert.rejects(launchWithDriver(driver, options), {code: 'ERR_BROWSER_CLOSED'});
  assert.deepEqual(driver.calls, ['launch', 'navigate', 'close']);
});

test('navigation hangs have a Carlo-owned deadline', async() => {
  const [{launchWithDriver}, {ScriptedChromeDriver}] = await modules();
  const driver = new ScriptedChromeDriver({navigate: 'hang'});
  await assert.rejects(launchWithDriver(driver, options), {code: 'ERR_NAVIGATION_TIMEOUT'});
});

test('cleanup failures are finite and classified', async() => {
  const [{launchWithDriver}, {ScriptedChromeDriver}] = await modules();
  const driver = new ScriptedChromeDriver({close: 'hang'});
  const app = await launchWithDriver(driver, options);
  await assert.rejects(app.close(), {code: 'ERR_CLEANUP_FAILED'});
  assert.deepEqual(driver.calls, ['launch', 'navigate', 'bridge', 'close', 'terminate']);
});

test('forced termination also has a finite cleanup deadline', async() => {
  const [{launchWithDriver}, {ScriptedChromeDriver}] = await modules();
  const driver = new ScriptedChromeDriver({close: 'hang', terminate: 'hang'});
  const app = await launchWithDriver(driver, options);
  await assert.rejects(app.close(), error =>
    error.code === 'ERR_CLEANUP_FAILED' && error.operation === 'cleanup.browser-close');
  assert.deepEqual(driver.calls, ['launch', 'navigate', 'bridge', 'close', 'terminate']);
});

test('browser launch hangs have a Carlo-owned deadline', async() => {
  const [{launchWithDriver}, {ScriptedChromeDriver}] = await modules();
  const driver = new ScriptedChromeDriver({launch: 'hang'});
  await assert.rejects(launchWithDriver(driver, options), {
    code: 'ERR_BROWSER_LAUNCH_FAILED', operation: 'launch.browser',
  });
});

test('bridge readiness hangs have a Carlo-owned deadline', async() => {
  const [{launchWithDriver}, {ScriptedChromeDriver}] = await modules();
  const driver = new ScriptedChromeDriver({bridge: 'hang'});
  await assert.rejects(launchWithDriver(driver, options), {
    code: 'ERR_BRIDGE_INIT_FAILED', operation: 'launch.bridge',
  });
  assert.deepEqual(driver.calls, ['launch', 'navigate', 'bridge', 'close']);
});
