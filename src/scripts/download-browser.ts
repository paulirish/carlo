import {CHROME_BUILD_ID, provisionBrowser} from '../internal/browser-build.js';

console.log(`Installing Chrome (${CHROME_BUILD_ID})...`);
provisionBrowser().then(executablePath => {
  console.log(`Chrome successfully installed at: ${executablePath}`);
}).catch((error: unknown) => {
  console.error('Failed to download browser:', error);
  process.exitCode = 1;
});
