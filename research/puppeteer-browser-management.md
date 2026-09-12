# Puppeteer browser discovery and management for a modern Carlo

Research date: 2026-09-12

## Bottom line

Yes: Puppeteer now has **public, supported APIs** for the parts of Carlo's browser discovery that should remain:

- `puppeteer-core.launch({channel: 'chrome' | 'chrome-beta' | 'chrome-dev' | 'chrome-canary'})` locates a system Chrome installation at the channel's known OS location and launches it. With `puppeteer-core`, either `channel` or `executablePath` is required. [Puppeteer `launch()`](https://pptr.dev/api/puppeteer.puppeteernode.launch) and [`LaunchOptions`](https://pptr.dev/api/puppeteer.launchoptions)
- `puppeteer-core.executablePath(channel)` is a public way to compute the conventional path for a Chrome channel. [PuppeteerNode API](https://pptr.dev/api/puppeteer.puppeteernode)
- `computeSystemExecutablePath()` from `@puppeteer/browsers` is the lower-level public API that checks the known system locations and returns a path or throws. [`computeSystemExecutablePath()`](https://pptr.dev/browsers-api/browsers.computesystemexecutablepath)
- `resolveBuildId()`, `install()`, `getInstalledBrowsers()`, `computeExecutablePath()`, and `uninstall()` form the public API for an application-managed Chrome for Testing cache. [`@puppeteer/browsers` API](https://pptr.dev/browsers-api)

Carlo should delete most of its hand-maintained OS path probing and recursive cache crawling. It should not import `puppeteer-core/internal/*`, `ChromeLauncher`, `BrowserLauncher`, `resolveSystemExecutablePaths`, or the `Cache` implementation. Those are implementation details even where package export patterns make a file technically importable. The supported seams already cover channel lookup, cache lookup, installation, removal, and launch.

The public system lookup is deliberately narrower than Carlo's current heuristic search: it knows conventional **Google Chrome** locations for stable, beta, dev, and canary. It is not a general search of `PATH`, desktop files, arbitrary Chromium installations, or arbitrary Chrome for Testing app bundles. Explicit `executablePath` remains the appropriate escape hatch for those cases.

## Pre-cleanup dependency snapshot

At the start of this research, the checkout contained two independently resolved versions of `@puppeteer/browsers`:

| Consumer | Resolved version | Evidence |
| --- | ---: | --- |
| Carlo's direct dependency | 2.13.2 | [`pnpm-lock.yaml`](../pnpm-lock.yaml) records `^2.7.0 -> 2.13.2`. |
| `puppeteer-core` 25.10.0 | 3.2.2 | [`pnpm-lock.yaml`](../pnpm-lock.yaml) records the nested 3.2.2 dependency. |

This was not just deduplication noise. In the installed 2.13.2 declarations, `computeSystemExecutablePath(options)` always validates that a path exists. In the nested 3.2.2 declarations used by Puppeteer Core, the signature is `computeSystemExecutablePath(options, validatePath?)`. Puppeteer Core uses that newer form internally. The immediate dependency cleanup aligned Carlo's direct dependency with Puppeteer Core's 3.2.2 release.

There was a second compatibility mismatch: [`package.json`](../package.json) advertised Node `>=18`, while the installed `puppeteer-core` 25.10.0 package declared Node `>=22.12.0`; Puppeteer's current system requirements say the same. [Puppeteer system requirements](https://pptr.dev/guides/system-requirements) The immediate dependency cleanup raised Carlo's Node floor to `>=22.12.0`.

## Public API inventory

### Locating and launching an installed Chrome

#### `puppeteer.launch({channel})`

Status: **public; preferred high-level API**.

`LaunchOptions.channel` accepts Puppeteer's `ChromeReleaseChannel`, currently the string union `'chrome' | 'chrome-beta' | 'chrome-canary' | 'chrome-dev'`. When supplied, Puppeteer looks for regular Chrome in a known system location instead of its downloaded browser. With `puppeteer-core`, callers must supply either `channel` or `executablePath`. [`ChromeReleaseChannel`](https://pptr.dev/api/puppeteer.chromereleasechannel), [`LaunchOptions`](https://pptr.dev/api/puppeteer.launchoptions)

This should be Carlo's normal path for system Chrome. Passing `channel` through to `launch()` avoids a separate time-of-check/time-of-use lookup and lets Puppeteer produce its own launch error if the browser is absent.

Important naming distinction: Puppeteer's high-level channel strings include the `chrome-` prefix, while `@puppeteer/browsers` exposes `ChromeReleaseChannel.STABLE`, `.BETA`, `.DEV`, and `.CANARY` whose values are `stable`, `beta`, `dev`, and `canary`. Use the type from the API being called rather than passing unvalidated strings between the two layers.

#### `puppeteer.executablePath(channel)`

Status: **public, but not an existence probe in Puppeteer Core 25.10.0**.

The method computes the default executable path for a channel. [PuppeteerNode API](https://pptr.dev/api/puppeteer.puppeteernode) Inspection of the installed 25.10.0 implementation shows its public method calls the internal launcher with path validation disabled. Therefore Carlo must not interpret a returned string as proof that Chrome exists. `launch({channel})` remains the better operation when the next step is launch.

#### `computeSystemExecutablePath({browser, channel, platform?}, validatePath?)`

Status: **public lower-level API**.

This API checks known installation locations and, by default, throws if Chrome is absent. `platform` is optional and auto-detected. The current API includes an optional `validatePath` argument. [`computeSystemExecutablePath()`](https://pptr.dev/browsers-api/browsers.computesystemexecutablepath)

Use this only if Carlo needs the resolved path before constructing launch options, for example to report which browser source was selected. Use `Browser.CHROME` and `ChromeReleaseChannel` from the top-level `@puppeteer/browsers` export.

The installed official implementation confirms the scope of the lookup:

- macOS: one `/Applications/Google Chrome*.app/...` path per channel;
- Linux: `/opt/google/chrome*/chrome` paths, plus WSL-aware Windows locations;
- Windows: conventional Google Chrome directories under the standard Program Files and local-app-data roots.

Those paths are first-party implementation behavior, not a promise to discover every Chrome-like executable. [Official `@puppeteer/browsers` source](https://github.com/puppeteer/puppeteer/blob/main/packages/browsers/src/browser-data/chrome.ts)

#### `detectBrowserPlatform()`

Status: **public**.

Returns Puppeteer's browser-download platform identifier or `undefined` if unsupported. The identifiers distinguish architecture where browser artifacts do, such as `mac` versus `mac_arm` and `win32` versus `win64`. [`detectBrowserPlatform()`](https://pptr.dev/browsers-api/browsers.detectbrowserplatform), [`BrowserPlatform`](https://pptr.dev/browsers-api/browsers.browserplatform)

Carlo should use it for cache/download operations rather than translating `process.platform` itself. It is not needed merely to call `puppeteer.launch({channel})`.

### Managing Chrome for Testing downloads

Puppeteer switched its supported Chrome download from Chromium to Chrome for Testing in v20. Chrome for Testing is the browser build Puppeteer tests against; Puppeteer explicitly does not guarantee compatibility with an arbitrary installed Chrome version. [Supported browsers](https://pptr.dev/supported-browsers), [Puppeteer `launch()` remarks](https://pptr.dev/api/puppeteer.puppeteernode.launch)

#### `resolveBuildId(browser, platform, tag)`

Status: **public; performs network-backed release resolution for symbolic tags**.

For Chrome, pass `Browser.CHROME`, a detected `BrowserPlatform`, and a `BrowserTag` such as `STABLE`, `BETA`, `CANARY`, or `LATEST`, or a version-like string. It resolves that tag to a concrete build ID. [`resolveBuildId()`](https://pptr.dev/browsers-api/browsers.resolvebuildid), [`BrowserTag`](https://pptr.dev/browsers-api/browsers.browsertag)

Do not resolve `stable` or `latest` on every Carlo launch. That makes launching network-dependent and silently changes the browser independently of the Puppeteer version. Resolve during an explicit provisioning operation and store/use the concrete result.

#### `install(options)`

Status: **public**.

With the default `unpack` behavior, `install({browser, buildId, cacheDir, platform})` downloads and unpacks a browser and returns an `InstalledBrowser`; its `executablePath` is the resolved binary path. With `unpack: false`, it returns the archive path instead. [`install()`](https://pptr.dev/browsers-api/browsers.install), [`InstallOptions`](https://pptr.dev/browsers-api/browsers.installoptions)

This belongs in an explicit `carlo browsers install`/setup workflow, not as an automatic fallback from a failed normal launch. Browser downloads are large, package-manager install scripts may be blocked, and Puppeteer's own guidance treats manual browser installation as a distinct workflow. [Installation guide](https://pptr.dev/guides/installation)

#### `getInstalledBrowsers({cacheDir})`

Status: **public**.

Returns `InstalledBrowser[]` metadata for installations represented in a cache directory; each result supplies `browser`, `buildId`, `platform`, and `executablePath`. [`getInstalledBrowsers()`](https://pptr.dev/browsers-api/browsers.getinstalledbrowsers), [`InstalledBrowser`](https://pptr.dev/browsers-api/browsers.installedbrowser)

The installed 2.13.2 cache implementation enumerates cache directory names and constructs metadata; it does not verify each executable while listing. Treat the result as cache inventory, not proof that the file can launch. Let `puppeteer.launch({executablePath})` validate the selected target and report a useful failure.

#### `computeExecutablePath({cacheDir, browser, buildId, platform?})`

Status: **public**.

Computes the expected executable path for one cache/build tuple. It does not download the browser. [`computeExecutablePath()`](https://pptr.dev/browsers-api/browsers.computeexecutablepath)

Prefer the `InstalledBrowser.executablePath` returned by `install()` or `getInstalledBrowsers()` when that object is already available. Use `computeExecutablePath()` when Carlo already has a concrete build ID but not an inventory object.

#### `uninstall(options)`

Status: **public**.

Removes a particular browser/platform/build from an application cache. [`uninstall()`](https://pptr.dev/browsers-api/browsers.uninstall)

Use this for explicit cache cleanup. Do not instantiate or call the internal `Cache.clear()` implementation.

#### `puppeteer.trimCache()`

Status: **public on `PuppeteerNode`, but a poor fit for Carlo's independently managed cache**.

The method removes non-current browser binaries from Puppeteer's configured cache, while warning that another installed Puppeteer version may still require them. [`trimCache()`](https://pptr.dev/api/puppeteer.puppeteernode.trimcache) Carlo can offer precise cleanup based on `getInstalledBrowsers()` and `uninstall()` instead of delegating ownership of a shared cache.

### Process-only launch in `@puppeteer/browsers`

`@puppeteer/browsers.launch({executablePath, args, ...})` is public, but it launches and supervises a process; it does not create Puppeteer's `Browser` automation object. [`@puppeteer/browsers launch()`](https://pptr.dev/browsers-api/browsers.launch) Carlo should continue using `puppeteer-core.launch()` for the actual application browser.

## What is internal or unsuitable

| API or technique | Status | Why Carlo should avoid it |
| --- | --- | --- |
| `puppeteer-core/internal/*` | Internal implementation surface | The wildcard package export permits access but does not make these modules stable public API. |
| `ChromeLauncher` / `BrowserLauncher` | Marked internal in Puppeteer source | `puppeteer.launch()` and `puppeteer.executablePath()` are the supported facades. |
| `resolveSystemExecutablePaths()` | Marked internal and absent from the `@puppeteer/browsers` top-level API | It exposes Puppeteer's current path list rather than a stable operation. Use `computeSystemExecutablePath()`. |
| `Cache` constructor and mutation methods | Cache class is exported, but its implementation and several members are marked internal | Use `getInstalledBrowsers()`, `computeExecutablePath()`, and `uninstall()`. |
| `PUPPETEER_REVISIONS` or Puppeteer's revisions source file | Internal build-time compatibility data | Pin Carlo's Puppeteer/browser provisioning contract explicitly instead of importing an internal constant. |
| Recursive search under `.cache/puppeteer` | Carlo-specific heuristic | It can select an arbitrary or stale executable and ignores the cache's browser/platform/build identity. |
| Checking only `fs.access()` | Insufficient validation | Existence/readability does not establish that a file is a compatible browser executable. The actual launch is the authoritative check. |

The public API classification above is reflected by Puppeteer's generated API reference, which lists the package's supported functions and marks constructors or members that third-party code should not call. [`@puppeteer/browsers` API index](https://pptr.dev/browsers-api)

## Recommended Carlo policy

### Resolution order

1. If the caller supplies `executablePath`, pass it to `puppeteer-core.launch()`. Do not claim compatibility before launch.
2. If the caller supplies a system `channel`, pass the mapped Puppeteer channel directly to `puppeteer-core.launch({channel})`.
3. If the caller selects an application-managed download, select a concrete `InstalledBrowser` from Carlo's dedicated browser cache and pass its `executablePath` to `puppeteer-core.launch()`.
4. Otherwise use one documented default, preferably system stable Chrome, and fail with a message that gives the explicit-path and provisioning remedies.

Do not silently cascade across system channels, arbitrary Chromium executables, stale caches, and a network download. Deterministic selection produces failures users can understand and reproduce.

### Download/version policy

Pin `puppeteer-core` to an exact release for the initial revival and provision the exact Chrome for Testing build that Puppeteer's supported-browser table associates with it. Update those together and verify Carlo's browser suite before publishing. Puppeteer's supported-browser table is the authoritative compatibility mapping. [Supported browsers](https://pptr.dev/supported-browsers)

There is no documented public Puppeteer Core API that returns its own guaranteed-compatible Chrome for Testing build ID for use with `@puppeteer/browsers.install()`. Importing `PUPPETEER_REVISIONS` would cross an internal boundary. Consequently Carlo should choose one of these explicit designs:

- **Preferred for a library:** keep `puppeteer-core` plus a matching `@puppeteer/browsers`, and maintain one Carlo-owned concrete build ID alongside the exact Puppeteer version.
- **Simpler but heavier:** depend on full `puppeteer` and adopt its install/configuration workflow. Puppeteer downloads its supported browser and supplies defaults, whereas `puppeteer-core` deliberately does not. [Installation guide](https://pptr.dev/guides/installation)

For Carlo's use case, the first design avoids a dependency postinstall download and keeps provisioning an explicit user action.

### Cache and profile ownership

Keep these separate:

- a durable **browser binary cache**, inventoried with `getInstalledBrowsers()` and cleaned with `uninstall()`;
- a durable or ephemeral **Chrome user-data directory**, selected according to Carlo's persistence contract;
- temporary launch artifacts, which Carlo owns and deletes after browser shutdown.

`@puppeteer/browsers` manages the first category only. `LaunchOptions.userDataDir` controls the second. [`LaunchOptions`](https://pptr.dev/api/puppeteer.launchoptions)

### Minimal API surface for Carlo

Carlo likely needs only these imports:

```js
const puppeteer = require('puppeteer-core');
const {
  Browser,
  BrowserTag,
  detectBrowserPlatform,
  getInstalledBrowsers,
  install,
  resolveBuildId,
  uninstall,
} = require('@puppeteer/browsers');
```

`computeSystemExecutablePath()` is optional: use it only if Carlo's public API must identify the resolved system path before launch. `computeExecutablePath()` is optional when Carlo retains `InstalledBrowser` objects. Neither Puppeteer's internal launcher classes nor Carlo's current OS-specific search functions are necessary for the common path.

## Implications for the current implementation

[`lib/find_chrome.js`](../lib/find_chrome.js) currently combines six different responsibilities: explicit-path handling, environment overrides, recursive cache inspection, OS-specific system probing, release selection, and downloading. A modern implementation should remove this file or replace it with a small policy module that returns a typed launch choice such as `{channel}` or `{executablePath}`. Provisioning and cache cleanup should live outside the launch path.

[`scripts/download-browser.js`](../scripts/download-browser.js) already uses public browser APIs, but resolving `stable` at execution time means the selected browser can move independently of `puppeteer-core`. It should provision the Carlo-supported concrete build, record/report it, and share the same cache policy as runtime lookup.

The current recursive cache search can pick the first filename resembling Chrome regardless of browser, platform, build, or compatibility. Replace it with `getInstalledBrowsers({cacheDir})`, exact filtering, and Puppeteer's version comparator if ordering multiple concrete versions is genuinely required. [`getVersionComparator()`](https://pptr.dev/browsers-api/browsers.getversioncomparator)

## Sources and scope

External sources are restricted to Puppeteer's official generated documentation and the official Puppeteer repository. Local version-specific conclusions were checked against the installed package declarations and implementations, [`package.json`](../package.json), and [`pnpm-lock.yaml`](../pnpm-lock.yaml). The online API reference displayed version 25.10.0 during research; where the direct installed `@puppeteer/browsers` 2.13.2 differs from the 3.x API used by Puppeteer Core, that difference is called out explicitly above.
