import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {Browser, detectBrowserPlatform, install} from '@puppeteer/browsers';

/** The exact Chrome for Testing build paired with this Carlo release. */
export const CHROME_BUILD_ID = '152.0.7977.75';

export async function provisionBrowser(cacheDirectory?: string): Promise<string> {
  const platform = detectBrowserPlatform();
  if (platform === undefined)
    throw new Error('Could not detect platform for browser installation.');
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const cacheDir = cacheDirectory ?? process.env.CARLO_BROWSER_DIR ?? resolve(packageRoot, '.local-browser');
  const installed = await install({
    browser: Browser.CHROME,
    buildId: CHROME_BUILD_ID,
    cacheDir,
    platform,
  });
  return installed.executablePath;
}
