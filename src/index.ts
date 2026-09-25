import {fileURLToPath} from 'node:url';
import {CarloError, carloError, type JsonValue} from './errors.js';
import {PuppeteerChromeDriver} from './internal/puppeteer-driver.js';
import {launchWithDriver} from './internal/launcher.js';

export {CarloError};
export type {CarloErrorCode, JsonValue} from './errors.js';

export type Capability = (...args: JsonValue[]) => JsonValue | Promise<JsonValue>;
export type BrowserChoice =
  | {readonly kind: 'system'; readonly channel?: 'chrome' | 'chrome-beta' | 'chrome-dev' | 'chrome-canary'}
  | {readonly kind: 'executable'; readonly path: URL};
export interface LaunchOptions {
  readonly id: string;
  readonly entry: URL;
  readonly capabilities?: Readonly<Record<string, Capability>>;
  readonly browser?: BrowserChoice;
  readonly display?: 'window' | 'headless';
  readonly startupTimeoutMs?: number;
  readonly navigationTimeoutMs?: number;
}
export interface App {
  readonly closed: Promise<{readonly reason: 'requested' | 'last-window-closed'}>;
  close(): Promise<void>;
}

function positiveTimeout(value: number | undefined, name: string): number {
  const selected = value ?? 30_000;
  if (!Number.isSafeInteger(selected) || selected <= 0)
    throw carloError('ERR_INVALID_OPTIONS', 'launch.options', `${name} must be a positive integer`);
  return selected;
}

/** The only stable construction seam. Driver adapters remain package-private. */
export async function launch(options: LaunchOptions): Promise<App> {
  if (!options || typeof options.id !== 'string' || !(options.entry instanceof URL))
    throw carloError('ERR_INVALID_OPTIONS', 'launch.options', 'id and an absolute entry URL are required');
  if (!/^(?=.{3,239}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(options.id))
    throw carloError('ERR_INVALID_OPTIONS', 'launch.options', 'id must be a lowercase reverse-DNS identifier');
  if (options.entry.protocol !== 'file:')
    throw carloError('ERR_INVALID_OPTIONS', 'launch.options', 'the M1 package skeleton accepts file entries only');

  const browser = options.browser ?? {kind: 'system' as const, channel: 'chrome' as const};
  const request = browser.kind === 'executable' ? {executablePath: fileURLToPath(browser.path)} :
    {channel: browser.channel ?? 'chrome'};
  const startupTimeoutMs = positiveTimeout(options.startupTimeoutMs, 'startupTimeoutMs');
  const running = await launchWithDriver(new PuppeteerChromeDriver(), {
    entry: options.entry,
    request: {...request, headless: options.display === 'headless', startupTimeoutMs},
    startupTimeoutMs,
    navigationTimeoutMs: positiveTimeout(options.navigationTimeoutMs, 'navigationTimeoutMs'),
  });
  let resolveClosed!: (exit: {readonly reason: 'requested' | 'last-window-closed'}) => void;
  const closed = new Promise<{readonly reason: 'requested' | 'last-window-closed'}>(resolve => {
    resolveClosed = resolve;
  });
  let closedResolved = false;
  const settleClosed = (reason: 'requested' | 'last-window-closed') => {
    if (closedResolved) return;
    closedResolved = true;
    resolveClosed({reason});
  };
  let closeRequested = false;
  void running.disconnected.then(
    () => { if (!closeRequested) settleClosed('last-window-closed'); },
    () => { if (!closeRequested) settleClosed('last-window-closed'); },
  );
  let close: Promise<void> | undefined;
  return {
    closed,
    close() {
      closeRequested = true;
      close ??= running.close().then(() => settleClosed('requested'));
      return close;
    },
  };
}
