# Carlo v1 specification

Status: proposed
Date: 2026-09-12

This document is normative for the stable Carlo v1 interface. “Must” and “must not”
describe release-blocking behavior. Product motivation is in
[PRODUCT.md](./PRODUCT.md); delivery sequencing is in
[MODERNIZATION_PLAN.md](./MODERNIZATION_PLAN.md).

## Runtime support

- Node: `>=22.12.0`; CI covers the minimum line and each newer supported LTS line.
- Package: ESM JavaScript compiled from TypeScript, with declarations.
- Browser automation: exact-pinned `puppeteer-core`.
- Deterministic browser: one exact Chrome for Testing build paired with Puppeteer.
- System browser: stable, beta, dev, and canary Google Chrome channels where
  Puppeteer supports them.
- Platforms: macOS, Linux, and Windows.

Arbitrary Chromium builds may be supplied by executable path, but Carlo guarantees
only the pinned Chrome for Testing build and its documented system-Chrome smoke
policy.

## Stable Node interface

The TypeScript below defines the intended shape. Exact naming may change before
ratification; after ratification, changes require an explicit specification decision.

```ts
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | {
  readonly [key: string]: JsonValue;
};

type Capability = (...args: JsonValue[]) => JsonValue | Promise<JsonValue>;
type Capabilities = Readonly<Record<string, Capability>>;

type BrowserChoice =
  | {readonly kind: 'system'; readonly channel?:
      'chrome' | 'chrome-beta' | 'chrome-dev' | 'chrome-canary'}
  | {readonly kind: 'executable'; readonly path: URL}
  | {readonly kind: 'managed'};

type ProfileChoice =
  | {readonly kind: 'temporary'}
  | {readonly kind: 'persistent'; readonly path: URL};

type WindowOptions = {
  readonly title?: string;
  readonly width?: number;
  readonly height?: number;
  readonly left?: number;
  readonly top?: number;
  readonly background?: string;
};

type Permission =
  | 'camera'
  | 'microphone'
  | 'geolocation'
  | 'notifications'
  | 'clipboard-read'
  | 'clipboard-write';

type Bounds = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

type OpenOptions = {
  readonly path?: string;
  readonly window?: WindowOptions;
};

type AppExit = {
  readonly reason: 'requested' | 'last-window-closed';
};

type WindowExit = {
  readonly reason: 'requested' | 'user-closed' | 'app-closed';
};

type CarloErrorCode =
  | 'ERR_INVALID_OPTIONS'
  | 'ERR_BROWSER_NOT_FOUND'
  | 'ERR_BROWSER_LAUNCH_FAILED'
  | 'ERR_BROWSER_CLOSED'
  | 'ERR_MANAGED_BROWSER_NOT_INSTALLED'
  | 'ERR_PROFILE_IN_USE'
  | 'ERR_CONTENT_NOT_FOUND'
  | 'ERR_CONTENT_LOAD_FAILED'
  | 'ERR_UNTRUSTED_DOCUMENT'
  | 'ERR_NAVIGATION_FAILED'
  | 'ERR_NAVIGATION_TIMEOUT'
  | 'ERR_NAVIGATION_SUPERSEDED'
  | 'ERR_BRIDGE_INIT_FAILED'
  | 'ERR_BRIDGE_PROTOCOL'
  | 'ERR_CAPABILITY_NOT_FOUND'
  | 'ERR_CAPABILITY_FAILED'
  | 'ERR_INVALID_VALUE'
  | 'ERR_DOCUMENT_REPLACED'
  | 'ERR_WINDOW_CLOSED'
  | 'ERR_APP_CLOSED'
  | 'ERR_CLEANUP_FAILED'
  | 'ERR_UNSUPPORTED';

type LaunchOptions = {
  readonly id: string;
  readonly entry: URL;
  readonly capabilities?: Capabilities;
  readonly browser?: BrowserChoice;
  readonly profile?: ProfileChoice;
  readonly display?: 'window' | 'headless';
  readonly permissions?: readonly Permission[];
  readonly window?: WindowOptions;
  readonly startupTimeoutMs?: number;
  readonly navigationTimeoutMs?: number;
};

declare function launch(options: LaunchOptions): Promise<App>;

declare class CarloError extends Error {
  readonly code: CarloErrorCode;
  readonly operation: string;
  readonly details?: Readonly<Record<string, JsonValue>>;
  readonly cause?: unknown;
}

interface App {
  readonly mainWindow: AppWindow | undefined;
  readonly windows: readonly AppWindow[];
  readonly closed: Promise<AppExit>;
  open(options?: OpenOptions): Promise<AppWindow>;
  close(): Promise<void>;
}

interface AppWindow {
  readonly closed: Promise<WindowExit>;
  navigate(path: string): Promise<void>;
  evaluate<Args extends readonly JsonValue[]>(
    fn: (...args: Args) => JsonValue | Promise<JsonValue>,
    ...args: Args
  ): Promise<JsonValue>;
  bringToFront(): Promise<void>;
  getBounds(): Promise<Bounds>;
  setBounds(bounds: Partial<Bounds>): Promise<void>;
  setState(state: 'normal' | 'minimized' | 'maximized' | 'fullscreen'):
    Promise<void>;
  close(): Promise<void>;
}
```

`App` must not repeat `AppWindow` methods. `open()` may be absent from the alpha, but
its final v1 behavior must fit this interface without changing launch or capabilities.

## Launch contract

### Input

- Parse the complete options object at the external seam.
- Unknown keys, invalid union combinations, unsafe capability names, relative URLs,
  and unsupported schemes reject with `ERR_INVALID_OPTIONS`.
- `id` is a required caller-selected reverse-DNS identifier. Carlo must not infer it
  from the current directory or package metadata.
- `id` contains at least two lowercase dot-separated DNS labels. Each label begins
  and ends with an ASCII letter or digit and may contain internal hyphens. Labels
  are 1–63 bytes; the complete identifier is at most 239 bytes. Carlo performs no
  case folding, Unicode normalization, or implicit rewriting.
- Executable and persistent-profile paths are absolute `file:` URLs.
- Width and height are positive integers; positions are integers, all expressed in
  device-independent screen pixels. Timeout values are positive finite integers.
- Capability registration is immutable after launch.
- `background`, when present, is exactly six- or eight-digit hexadecimal CSS color.

### Defaults

- Browser: `{kind: 'system', channel: 'chrome'}`.
- Profile: `{kind: 'temporary'}`.
- Display: `'window'`.
- Permissions: none.
- Startup and navigation timeout: 30 seconds each.
- Internal window commands and graceful browser shutdown: 10 seconds; after the
  graceful shutdown deadline Carlo terminates its owned browser process.
- A `file:` URL means a file entry. A loopback `http:` or `https:` URL means a
  development-server entry. No other entry scheme is accepted.

### Readiness

`launch()` resolves only after these refer to the same live initial document:

1. selected Chrome process launched;
2. application window adopted;
3. expected trusted origin committed;
4. `DOMContentLoaded` occurred;
5. capability bridge handshake completed.

On failure, `launch()` rejects after all Carlo-owned resources are cleaned. It must
not return a partially usable `App`.

Normal launch must not discover or download a browser over the network. Browser
choices are mutually exclusive and never cascade after failure.

## Application identity and content

### File entry

- The entry must be an absolute `file:` URL naming an existing regular file.
- Its lexical parent is the content root. The entry and every served path are
  rejected if symlink resolution escapes that root.
- The exact origin is `https://<id>.carlo.invalid`, an injective and version-stable
  mapping from the validated identifier. Browser URLs do not expose raw filesystem
  paths. Carlo must intercept every request to that host; an unintercepted request
  is aborted and must never reach DNS or the network.
- Relative assets resolve within the root.
- `GET` and `HEAD` are supported. There is no directory listing or implicit SPA
  fallback.
- Missing content produces 404. A missing main document rejects with
  `ERR_CONTENT_NOT_FOUND`.
- Decode paths once. Malformed escapes, NULs, absolute filesystem paths, lexical
  traversal, and resolved symlink escape must not read content.

Mounted files are trusted developer input. Carlo does not claim to defeat a
same-user attacker concurrently replacing trusted directories; portable Node has no
`openat`-style directory walk, so the implementation must not promise otherwise.

### Development server

- The URL uses `http:` or `https:` and `localhost`, a `127.0.0.0/8` address, or
  `[::1]`; hostname resolution must also produce only loopback addresses. Carlo
  navigates to it directly and does not proxy or rewrite it under the synthetic
  origin.
- The exact scheme/host/port tuple is the trusted origin. Storage identity therefore
  changes when the port changes.
- Paths, queries, methods, redirects, cookies, authentication, subresources, status
  codes, TLS, and WebSockets retain ordinary Chrome behavior. Carlo adds only its
  top-level origin and lifecycle checks.
- A startup redirect outside the declared origin rejects with
  `ERR_UNTRUSTED_DOCUMENT`. A connection failure during Carlo-owned navigation
  rejects with `ERR_NAVIGATION_FAILED` and preserves its cause.
- Non-loopback origins are outside v1.

## Page capability interface

Before the first author script, the trusted top-level document receives frozen
`globalThis.carlo` and `carlo.capabilities`. Each configured own property is an async
function.

Capability names match `^[A-Za-z_$][A-Za-z0-9_$]*$` and must not be `__proto__`,
`prototype`, or `constructor`. They cannot change after launch.

The capability codec accepts null, booleans, strings, finite numbers, dense arrays,
and plain objects whose prototype is `Object.prototype` or null. Negative zero is
decoded as zero. Object properties must be enumerable own data properties. Array
holes, accessors, `undefined`, non-finite numbers, cycles, class instances,
functions, symbols, and bigints reject with `ERR_INVALID_VALUE`; no prototype is
coerced. Maximum nesting is 64 and each encoded argument list or result is at most
1 MiB of UTF-8 JSON. Protocol messages with unknown fields or duplicate correlation
identifiers reject with `ERR_BRIDGE_PROTOCOL`.

Calls made after namespace injection but before the generation handshake are owned
by that generation and queued, up to 256 pending calls per window. They begin only
after origin, frame, and generation validation. Overflow rejects with
`ERR_BRIDGE_PROTOCOL`; retirement rejects queued calls with
`ERR_DOCUMENT_REPLACED`.

Node failures become page-side `CarloCallError` values with stable code, safe
message, and capability name. Node stacks and arbitrary error properties do not
cross into the page.

```ts
interface CarloCallError extends Error {
  readonly name: 'CarloCallError';
  readonly code: string;
  readonly capability: string;
}
```

Carlo-owned bridge work has finite timeouts. Capability duration belongs to the
application and is not silently timed out. If its document retires, the page promise
rejects; the Node handler may continue unless the application implements cancellation.

Likewise, caller-supplied `evaluate()` code and the lifetime represented by `closed`
have no duration limit: their completion is controlled by application work or a
lifecycle terminal event, not Carlo orchestration. `evaluate()` arguments and
results use the same JSON codec as capabilities.

| Operation | Owner | Deadline and terminal behavior |
| --- | --- | --- |
| launch orchestration | Carlo | startup timeout; reject after cleanup |
| navigation and bridge connection | Carlo | navigation timeout; retire generation |
| window commands | Carlo | 10 seconds; reject without silent success |
| graceful shutdown | Carlo | 10 seconds, then terminate the owned browser |
| `evaluate()` body | application | no duration timeout; reject on document/window/browser retirement |
| capability handler | application | no duration timeout; discard a late result after generation retirement |
| `closed` lifetime | application/browser | no duration timeout; settle on its terminal event |

## Trust contract

The trusted top-level application—including third-party scripts it loads—can invoke
every configured capability. Carlo is not an XSS sandbox. Applications must expose
least privilege and treat web dependencies as privileged code.

Capabilities must not exist in:

- cross-origin top-level documents;
- documents reached by an untrusted redirect;
- any iframe, including same-origin iframes in v1;
- unadopted popups;
- retired document generations.

Permissions default to denied and apply only to the trusted application origin.
Carlo actively installs denial for every supported permission rather than relying on
Chrome prompts. Requested grants are installed only for the trusted origin;
unsupported permission names reject launch, and all overrides are cleared at app
shutdown. Navigating away conveys no grant to the destination.
External scripts execute with trusted-document privilege if the app loads them. CSP
may be added later; it is not an unstated v1 guarantee.

## Document generations and navigation

Each top-level document has a monotonically increasing generation owned by its
window.

```text
open -> generation 1 ready
              |
           navigate
              v
generation 1 retired -> generation 2 connecting -> generation 2 ready
```

- A new top-level navigation retires the previous generation before accepting calls
  from the new one.
- Retirement rejects its pending page calls with `ERR_DOCUMENT_REPLACED`.
- A second Carlo navigation supersedes the first, which rejects with
  `ERR_NAVIGATION_SUPERSEDED`.
- `navigate(path)` accepts an application-relative path only.
- Navigation resolves only when commit, DOM readiness, and bridge readiness identify
  the same final generation.
- Failed, timed-out, superseded, untrusted, and browser-closed navigation have
  distinct codes.
- Ordinary links may leave the application, but doing so retires the bridge and the
  external document receives no capabilities.
- Returning to the exact trusted origin creates a fresh generation and receives a
  bridge only after the same validation and handshake.
- Script- or link-created popups are closed immediately in v1. They are never
  adopted, never enter `app.windows`, receive no capabilities, and do not keep the
  application alive. Applications create windows only through `app.open()`.

No document uses a process-global RPC singleton or a callback slot another document
can overwrite.

## Window and application lifecycle

```text
launching -> ready -> closing -> closed
    |          |         |
    +----------+---------+-> failed
```

- `close()` is idempotent under concurrent calls.
- `AppWindow.closed` settles exactly once.
- Remove a window from `app.windows` before its `closed` promise settles.
- `windows` is a frozen creation-order snapshot computed on each property read.
- `mainWindow` is the oldest live window, or `undefined` after the registry becomes
  empty; it can therefore change when the original window closes.
- Closing the final window initiates application shutdown.
- `App.closed` settles after windows are terminal, Chrome is gone, and owned
  temporary resources are cleaned.
- Requested application close, requested window close, user window close, and
  final-window shutdown resolve with the discriminants declared above.
- Browser crash, pipe loss, invariant violation, and cleanup failure reject
  `App.closed` and every affected `AppWindow.closed` with `CarloError`.
- `App.close()` resolves with successful shutdown. It rejects with the same terminal
  cleanup error as `App.closed`; calling it after a completed shutdown is a no-op,
  while calling it after failed shutdown rethrows that terminal error.
- In-flight navigation and bridge calls reject before the corresponding closed
  promise settles.
- Unsupported platform window operations reject; they do not silently no-op.

`open()` inherits the app's entry, content root, origin, profile, browser, and
capabilities. Its optional `path` is application-relative and defaults to the entry
path. It resolves only after the new window's document passes the full readiness
contract. No window-specific capability map exists in v1.

## Profile ownership

- Carlo-created temporary profiles are removed after close, startup failure, and any
  observable browser failure while the Node process remains alive.
- Caller-provided persistent profiles are never deleted.
- A locked persistent profile rejects with `ERR_PROFILE_IN_USE`; Carlo must not
  choose a fresh profile.
- Browser caches and profiles are separate paths and ownership domains.

The test harness, not the runtime, owns cleanup after a test aborts without closing
its app. Carlo makes best-effort cleanup on catchable process termination but cannot
guarantee cleanup after `SIGKILL`, power loss, or host-process failure. The same
limit applies to terminating browser processes.

## Browser selection and provisioning

System selection passes the public channel to `puppeteer-core.launch({channel})`.
Explicit and managed choices use `puppeteer-core.launch({executablePath})`.

Managed provisioning is a separate CLI interface:

```text
carlo browser install
carlo browser path
carlo browser remove
```

It uses public `@puppeteer/browsers` interfaces and Carlo's exact supported build.
Managed launch uses that installed build or rejects with
`ERR_MANAGED_BROWSER_NOT_INSTALLED`; it never downloads.

Carlo must not import Puppeteer internal launchers, cache implementations, revision
constants, or internal subpaths. See
[Puppeteer browser-management research](./research/puppeteer-browser-management.md).

## Error interface

Carlo exports one `CarloError`. Its `code` and `operation` are stable;
Puppeteer/CDP/OS error text is not. `details` contains only documented JSON-safe
fields, and `cause` preserves the Node-side failure.

```text
ERR_INVALID_OPTIONS
ERR_BROWSER_NOT_FOUND
ERR_BROWSER_LAUNCH_FAILED
ERR_BROWSER_CLOSED
ERR_MANAGED_BROWSER_NOT_INSTALLED
ERR_PROFILE_IN_USE
ERR_CONTENT_NOT_FOUND
ERR_CONTENT_LOAD_FAILED
ERR_UNTRUSTED_DOCUMENT
ERR_NAVIGATION_FAILED
ERR_NAVIGATION_TIMEOUT
ERR_NAVIGATION_SUPERSEDED
ERR_BRIDGE_INIT_FAILED
ERR_BRIDGE_PROTOCOL
ERR_CAPABILITY_NOT_FOUND
ERR_CAPABILITY_FAILED
ERR_INVALID_VALUE
ERR_DOCUMENT_REPLACED
ERR_WINDOW_CLOSED
ERR_APP_CLOSED
ERR_CLEANUP_FAILED
ERR_UNSUPPORTED
```

Map errors centrally at the owning operation. Matching Puppeteer message substrings
must not be the primary classification mechanism.

## Module seams

The external seam is `launch()` returning `App`. Internal modules concentrate change;
callers do not assemble them.

- `ApplicationHost`: outline orchestration, lifecycle, window registry, readiness.
- `BrowserRuntime`: browser choice, launch, process observation, profile cleanup.
- `ContentHost`: synthetic origin, file responses, development-server trust, and
  exactly-once request resolution.
- `DocumentBridge`: codec, origin/frame checks, generations, calls, retirement.
- `ChromeWindow`: minimal verified window behavior absent from Puppeteer.

Puppeteer/CDP are true external dependencies. A private task-shaped driver seam may
have Puppeteer and scripted adapters; it must not mirror Puppeteer's object graph.
Real Chrome tests remain authoritative.

These names describe responsibility boundaries, not required classes, files, or
layers. Merge any boundary that only forwards calls and whose removal does not
redistribute meaningful complexity.

The filesystem is local-substitutable and tested with temporary trees. It does not
gain a public adapter.

## Unsupported 0.9 behavior

Stable v1 excludes:

- mutable `serveFolder()`, `serveOrigin()`, and `serveHandler()` setup;
- public `HttpRequest` interception;
- post-launch `exposeFunction()` and ambient global functions;
- arbitrary RPC handles, browser callback handles, and `rpc_process`;
- `loadParams()` and `paramsForReuse`;
- implicit downloads, revision/wildcard channels, environment selection, OS path
  lists, and recursive cache crawling;
- unconditional permissions, custom shortcuts, and file-path disclosure;
- unverified dock icons;
- test-named stable methods;
- CommonJS output.

An unstable Puppeteer subpath and custom routing are candidates, not commitments.
Each needs concrete use cases and a separate specification change.
