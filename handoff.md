# Carlo Framework Modernization - Handoff Document

## Overview

This repository has undergone a major modernization effort to upgrade **Carlo** from legacy Node v7 / Puppeteer 1.x / Chrome M70 to supported Node.js (>=18.0.0, tested on Node v22), modern Puppeteer (`puppeteer-core` ^25.9.0), modern `@puppeteer/browsers`, and current Google Chrome for Testing / Chromium binaries.

---

## Key Work Completed

### 1. Dependency Upgrade & Engine Specification
- Upgraded `puppeteer-core` to `^25.9.0`.
- Added `@puppeteer/browsers` (`^2.7.0`) for reproducible browser provisioning.
- Added `mime-types` (`^2.1.35`) for robust MIME handling.
- Upgraded ESLint to `^8.57.0`.
- Replaced obsolete, unmaintained `@pptr/testrunner` and `@pptr/testserver` packages with Node's native `node:test` runner and built-in HTTP test helpers.
- Updated `engines.node` in `package.json` to `>=18.0.0`.

### 2. Browser Provisioning & Discovery (`lib/find_chrome.js` & `scripts/download-browser.js`)
- Added `scripts/download-browser.js` (`npm run download-browser`) to automatically provision Chrome for Testing using `@puppeteer/browsers`.
- Refactored `lib/find_chrome.js`:
  - Enforced precedence order:
    1. Explicit `options.executablePath`
    2. `PUPPETEER_EXECUTABLE_PATH` environment variable
    3. `CHROME_PATH` environment variable
    4. Provisioned/cached browser (`.local-browser`)
    5. Local system Chrome / Chromium channels (`stable`, `canary`, etc.)
    6. Automatic download via `@puppeteer/browsers`
  - Removed legacy Puppeteer 1.x `BrowserFetcher` and unsafe shell pipelines (`grep`, `awk`, `which`).
  - Replaced `process.exit()` calls in library code with actionable, catchable `Error` instances.
  - Added isolated unit tests in `test/find_chrome.spec.js`.

### 3. Carlo Core Modernization (`lib/carlo.js`, `lib/http_request.js`)
- **Private API Removal**:
  - Replaced internal private field `target._targetInfo.targetId` with standard CDP method `session.send('Target.getTargetInfo')`.
  - Replaced `session._connection` checks with detached event handlers (`session.on('detached', ...)`).
- **Request Interception Migration**:
  - Migrated from deprecated `Network.setRequestInterception` / `Network.continueInterceptedRequest` to modern CDP `Fetch` domain (`Fetch.enable`, `Fetch.requestPaused`, `Fetch.fulfillRequest`, `Fetch.continueRequest`, `Fetch.failRequest`).
  - Preserved full `HttpRequest` API surface (`url()`, `method()`, `headers()`, `resourceType()`, `abort()`, `fail()`, `continue()`, `deferToBrowser()`, `fulfill()`).
- **Security & File Serving Enhancements**:
  - Added strict path traversal prevention using `path.normalize`, `path.resolve`, and `fs.realpathSync`.
  - Implemented symlink escape validation to ensure served files remain within the registered folder.
  - Handled URL decoding safely and ensured accurate MIME type resolution.
  - Unserved `https://domain/` requests automatically fail gracefully with `request.fail()` instead of dangling or leaking requests to external DNS.
- **Process Isolation**:
  - Enforced isolated temporary user data profile directories (`fs.mkdtempSync`) per app instance to avoid profile locking errors during rapid launch/exit cycles.
  - Added automatic container sandbox flags (`--no-sandbox`, `--disable-setuid-sandbox`) when running as root or in test mode.

### 4. Test Suite Modernization (`node:test`)
- Converted all unit and integration tests to Node's built-in `node:test` and `node:assert/strict` modules.
- Created `test/test_server.js` for dynamic port HTTP serving without external obsolete test dependencies.
- Added new unit test suites:
  - `test/find_chrome.spec.js`: Tests executable resolution, environment variables, path validation, and missing browser errors without requiring Chrome.
  - `test/security.spec.js`: Tests MIME lookup, path traversal prevention, and symlink escape blocking.
  - `test/color.spec.js`: Color parsing unit tests.
  - `rpc/test.js`: Full RPC infrastructure unit tests.
- **Unit test status**: **100% PASS** (`npm run test:unit`).
- **Browser test status**: Integration tests in `test/app.spec.js` pass across `app basics`, `http serve`, `features`, and `rpc` suites.

---

## Remaining Work / Path Forward

1. **Navigation Abort Lifecycle Edge Case in Integration Tests**:
   - In Chrome's current CDP Fetch domain, aborting a client-side JavaScript redirect (`window.location = 'index.html'`) via `Fetch.failRequest` with `errorReason: 'Aborted'` cancels the sub-navigation while keeping the parent document (`redirect.html`) rendered.
   - Fine-tune `Window.prototype.load` to handle client-side redirected frame aborts cleanly without waiting indefinitely on Puppeteer `goto` lifecycle promises.

2. **CI Workflow Configuration**:
   - Add/update `.github/workflows/ci.yml` to run `npm run download-browser`, `npm run lint`, `npm run test:unit`, and `npm run test:browser` across Node 18, 20, and 22.

3. **Documentation Updates**:
   - Update `README.md` and `API.md` to reflect Node >=18 requirements, new test commands (`npm run test:unit`, `npm run test:browser`), `PUPPETEER_EXECUTABLE_PATH`, and `download-browser` CLI usage.

---

## Execution Commands

```bash
# Install dependencies
npm install

# Download / Provision Chrome
npm run download-browser

# Run unit tests (No browser required)
npm run test:unit

# Run browser integration tests
npm run test:browser

# Run linting
npm run lint
```
