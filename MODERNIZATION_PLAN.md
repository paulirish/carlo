# Carlo modernization plan

Status: proposed  
Date: 2026-09-12

## Outcome

Produce a small, reliable Node application shell that launches a supported Chrome,
renders trusted web content, and provides an explicit Node-to-page capability bridge.
The revived package should preserve Carlo's useful idea and ergonomics without
preserving every 2018 implementation choice.

This is a replacement plan, not a commitment to repair every module currently in
the repository. Old code should be deleted once its retained behavior is covered by
black-box tests and a simpler implementation passes them.

## Starting evidence

The current checkout proves that the concept is still viable, but not that the 2026
port is complete:

- lint and all 30 current unit tests pass;
- 20 of 22 isolated browser behaviors pass on Node 25.8 and Chrome for Testing 141;
- failed navigation resolves as success because [`Window.load()`](./lib/carlo.js)
  swallows Puppeteer's navigation rejection;
- reloading while the RPC world initializes hangs indefinitely;
- after a multi-window navigation failure, later browser tests can hang despite
  passing in isolation, proving lifecycle state leaks across app instances;
- every default launch creates an abandoned Chrome profile and browser storage does
  not persist between launches;
- the browser finder accepts an arbitrary readable file as an executable;
- important upstream RPC, color, and browser tests were deleted during the port;
- several new “security” tests reproduce implementation snippets instead of
  exercising Carlo through its interface.

The Git history matters. Upstream development stopped in February 2020. The jump
from Puppeteer 1.12 to Puppeteer 25, the browser finder rewrite, the CDP Fetch
migration, and the test-runner migration arrived together in one bot-assisted
commit on 2026-09-12. The new implementation therefore has no sequence of small,
independently validated compatibility milestones to trust.

The companion [Puppeteer browser-management research](./research/puppeteer-browser-management.md)
records the supported modern APIs and version-specific findings used below.

An immediate dependency-baseline milestone accompanied this plan: all stale direct
dependencies were updated to the registry's current releases, runtime dependencies
were exact-pinned for stabilization, the duplicate `@puppeteer/browsers` major was
aligned with Puppeteer Core, and the Node floor was corrected to `>=22.12.0`.

## Product definition

Modern Carlo is:

- a headful Chrome app shell driven from Node;
- a way to serve or proxy trusted application content under one controlled origin;
- a capability bridge for calling explicitly exposed Node functions and objects;
- a thin window-management layer where Puppeteer itself has no equivalent;
- testable headlessly with the same exported interface used in production.

Modern Carlo is not:

- a general Chrome installation search engine;
- an Electron-compatible packaging or branding framework;
- a general-purpose RPC package for child processes;
- an arbitrary HTTP interception framework;
- a compatibility museum for every pre-1.0 option;
- responsible for silently downloading hundreds of megabytes during `launch()`.

## Interface decisions

### Browser selection

Replace the current overlapping strings, environment fallbacks, recursive cache
search, and implicit download path with one discriminated choice:

```js
await carlo.launch({
  browser: { channel: 'chrome' },
});

await carlo.launch({
  browser: { executablePath: '/path/to/chrome' },
});

await carlo.launch({
  browser: {
    managedBuild: '150.0.7871.24',
    cacheDir: '/path/to/carlo-browser-cache',
  },
});
```

Rules:

1. Default to `{channel: 'chrome'}` and pass it directly to public
   `puppeteer-core.launch({channel})`.
2. Treat `executablePath` as an explicit escape hatch for Chromium, unusual system
   installations, and callers that own browser provisioning.
3. Require an exact build ID for a managed browser at runtime.
4. Put network-backed installation in an explicit command such as
   `carlo browsers install`, implemented with public `@puppeteer/browsers` APIs.
5. Never fall through from a missing system browser to an implicit download.
6. Let launch be the authoritative executable validation. A prior `access()` check
   cannot prove that a file is a compatible browser and introduces a TOCTOU race.

Use public APIs only. In particular:

- system launch: `puppeteer-core.launch({channel})`;
- explicit/managed launch: `puppeteer-core.launch({executablePath})`;
- provisioning: `detectBrowserPlatform()`, `resolveBuildId()`, `install()`,
  `getInstalledBrowsers()`, and `uninstall()` from `@puppeteer/browsers`.

Do not import Puppeteer launcher classes, revision constants, cache internals, or
`puppeteer-core/internal/*`. Delete Carlo's OS-specific path lists and recursive
executable search.

### Profile ownership

Make profile lifetime explicit and separate it from the browser binary cache:

```js
await carlo.launch({profile: {mode: 'temporary'}});
await carlo.launch({profile: {mode: 'persistent', path: appProfilePath}});
```

- Temporary is the default. Carlo creates it and removes it after browser shutdown,
  launch failure, and test failure.
- Persistent requires a caller-provided path. Carlo never deletes it.
- A caller-provided Puppeteer `userDataDir` is represented by the persistent form;
  there is no ambiguous `localDataDir` that sometimes means profiles and sometimes
  means downloaded browsers.
- Profile-lock errors are reported directly with the chosen path. There is no
  fallback to another profile because that silently loses application state.

### Navigation and trust

- `load()` accepts application-relative URLs. Absolute main-frame navigation is
  rejected unless a future interface explicitly models it.
- `serveOrigin()` proxies development content under Carlo's controlled application
  origin; it does not grant that upstream origin direct access to Node capabilities.
- Exposed Node capabilities exist only in the main frame at the Carlo application
  origin. Cross-origin frames and pages do not receive the bridge.
- Camera, microphone, MIDI, notifications, geolocation, and clipboard permissions
  are opt-in launch options. Carlo no longer grants all of them unconditionally.
- Every navigation has a finite default timeout and a typed failure. No public
  promise waits forever and no navigation error is logged-and-discarded.

### Compatibility policy

This should be a new major version. Preserve source compatibility only for behavior
we intentionally retain; provide a migration table for everything else.

Keep for the first release:

- `launch()`, `App`, and `Window` as the small external interface;
- `load()`, `evaluate()`, `exposeFunction()`, `createWindow()`, `windows()`, and
  orderly `close()`/`exit()` events;
- folder serving and development-origin proxying;
- load parameters and capability handles across reloads;
- window bounds/front/minimize/maximize/fullscreen where Chrome supports them;
- file metadata if its security contract can be stated and tested.

Replace:

- imperative `HttpRequest.continue()/fail()/fulfill()` handlers with a return-valued
  route decision, so an omitted decision cannot suspend Chrome forever;
- module-global RPC bookkeeping with per-window, per-document bridge state;
- `pageForTest()`/`browserForTest()` naming with an explicitly unstable Puppeteer
  escape hatch, if an escape hatch remains necessary.

Delete unless repository or package-usage evidence proves a current use case:

- `paramsForReuse` and cross-process browser-profile reuse;
- `rpc_process` and the terminal-specific child-process abstraction;
- wildcard/revision channel strings and implicit downloads;
- custom keyboard-shortcut injection;
- the general color parser, replacing it with the narrow background-color behavior
  actually supported by the launch interface;
- dock-icon support that cannot be verified on supported platforms;
- stale examples, obsolete bundling instructions, and the handoff document after
  its valid findings have been incorporated into maintained documentation.

CommonJS versus ESM and JavaScript versus TypeScript are deliberately not Phase 1
goals. Module format did not cause the observed failures. First produce a correct,
typed-by-contract JavaScript implementation; consider a source-language change only
after the browser and bridge interfaces are stable. The published package can add
declarations without combining runtime repair with an unrelated rewrite.

## Target modules

The external seam remains `launch()` returning an `App`. Callers should not assemble
internal modules in a required sequence.

### `BrowserRuntime`

Interface: launch one configured browser and close it.

Implementation owns browser-choice parsing, exact dependency compatibility, profile
creation, Puppeteer launch options, shutdown, and owned-resource cleanup. Browser
selection and profile cleanup do not leak into `App`.

### `ContentRouter`

Interface: register application content and resolve each application-origin request
to exactly one response decision.

Implementation owns prefix matching, folder containment, MIME types, development
origin rewriting, custom route decisions, and final failure. Files must be opened
atomically and served from their file descriptors; path checks followed by a second
path-based read are not sufficient against symlink replacement.

Start with a focused spike using Puppeteer's public request-interception interface.
It must demonstrate response fulfillment, URL rewriting, aborts, redirects,
subresources, and main-frame error propagation. If one required operation is absent,
keep only that operation in a small CDP Fetch adapter behind the same internal seam
and document the exact reason. Do not retain the current all-CDP wrapper by default.

A loopback HTTP server is not the initial choice because a random port changes the
browser origin and persistent Web Storage identity, while a fixed port adds locking
and collision behavior. Revisit it only if the interception spike fails.

### `PageBridge`

Interface: expose named capabilities and attach load parameters to a document.

Implementation owns a single page binding, message parsing, capability handles,
pending calls, and document lifetime. Every top-level document receives a unique
generation. Navigation retires the previous generation, disposes its remote handles,
and rejects its pending calls with an explicit navigation error.

The page runtime initiates a fresh handshake for every document. Node must tolerate
the next document connecting before the previous document's initialization finishes.
There is no singleton callback slot that a reload can overwrite. Protocol messages
are parsed at the process boundary and modeled as a closed discriminated union.

### `ChromeWindow`

Interface: the retained window operations only.

Implementation owns the minimal documented CDP operations that Puppeteer does not
provide, such as Chrome window bounds. CDP session detachment is an explicit terminal
state, not a reason to swallow arbitrary command failures. Platform-specific
operations remain only when integration tests can exercise their supported platform.

### `App`

`App` is the outline orchestrator. It coordinates the modules above and contains no
browser search, path validation, protocol routing, or profile cleanup details.

Do not create public adapters for these modules merely to make tests convenient.
Internal seams are justified only when both a production adapter and an actual test
adapter exist. Most behavior should be tested through `launch()`/`App`/`Window`, the
same interface callers use.

## Execution phases

### Phase 0: record the contract

1. Recover the deleted upstream tests and enumerate every historical public behavior.
2. Classify each behavior as retain, intentionally remove, or defer.
3. Convert retained behaviors into black-box `node:test` cases before changing their
   implementations.
4. Add explicit negative tests for removed or forbidden behavior.
5. Record the Node, Puppeteer, Chrome for Testing, and system-Chrome support matrix.

Gate: every retained behavior either passes or has a minimal failing regression test
with an actionable timeout. The suite itself must always terminate.

### Phase 1: make the harness authoritative

1. Put finite timeouts on hooks, navigation, bridge calls, and tests.
2. Make server-listen, Chrome-launch, and teardown errors reject their owning hook.
3. Run browser tests against a pinned Chrome for Testing build.
4. Add a separate system-stable-Chrome smoke job; do not use it as the deterministic
   regression target.
5. Delete tests that duplicate production algorithms and replace them with tests
   through the relevant interface.
6. Restore the removed RPC cases: nested exceptions, function exceptions, invalid
   property calls, handle deduplication, child/grandchild routing if retained, and
   disposal during an in-flight call.

Gate: the known navigation and reload failures fail promptly and reproducibly; no
test can hang CI.

### Phase 2: replace browser and profile management

1. Keep the now-aligned exact `puppeteer-core` and `@puppeteer/browsers` releases
   pinned until the revival's browser contract is stable.
2. Enforce the corrected Node 22.12 minimum in CI and package-install fixtures.
3. Implement the three browser choices using the public APIs described above.
4. Move managed-browser installation and removal into explicit commands.
5. Implement temporary and persistent profile ownership with guaranteed cleanup.
6. Delete `lib/find_chrome.js` and its OS/cache crawler; replace
   `scripts/download-browser.js` with the exact-build provisioning command.

Gate: system-channel, explicit-path, managed-build, absent-browser, launch-failure,
temporary-cleanup, persistent-state, and locked-profile tests all pass. One hundred
rapid temporary launch/close cycles leave zero owned profiles behind.

### Phase 3: replace content routing and navigation

1. Complete the public-interception spike and choose the adapter based on its results.
2. Implement one `ContentRouter` resolution pipeline with a return-valued decision.
3. Make folder traversal protection operate on opened file descriptors rather than
   check-then-read paths.
4. Await Puppeteer's navigation result and separately await the bridge handshake for
   the final document generation.
5. Propagate aborted, failed, timed-out, superseded, and browser-closed navigation as
   distinct errors.
6. Delete `lib/http_request.js` and the current navigation callback slot.

Gate: all retained folder/origin/handler/history tests pass, including redirects,
encoded traversal, symlink-swap attempts, missing files, concurrent windows, and
superseded loads. No intercepted request can remain unresolved.

### Phase 4: replace the bridge

1. Define and test the small wire protocol before implementing transport details.
2. Implement document generations, capability ownership, disposal, and pending-call
   rejection.
3. Restrict bridge installation to the trusted top-level application document.
4. Implement `exposeFunction()` and load parameters on the new bridge.
5. Add object handles only after primitive/function calls and reload behavior pass.
6. Delete the old RPC implementation rather than layer the new bridge over it.

Gate: reload during handshake succeeds 100 consecutive times; navigation during an
in-flight call rejects deterministically; two windows cannot consume each other's
parameters or handles; external documents and subframes cannot call Node capabilities.

### Phase 5: retain only verified window features

1. Reimplement the retained window operations behind `ChromeWindow`.
2. Test create/close/exit ordering and concurrent windows.
3. Test bounds and state changes on each platform where CI supports them.
4. Remove unsupported icon, reuse, shortcut, and process-RPC features.

Gate: the public surface and support matrix contain no “best effort” feature whose
failure is silently ignored.

### Phase 6: package, document, and release

1. Replace the examples with one minimal app and one bridge-oriented app that depend
   on the workspace package, not published Carlo 0.9.
2. Rewrite the README and reference documentation against the retained interface.
3. Publish a migration table from 0.9.46, including every deletion and changed
   default.
4. Document browser provisioning, profile persistence, permissions, the trusted-page
   model, and failure modes.
5. Verify package contents from the packed tarball and install that tarball into an
   empty fixture project.
6. Release a major-version prerelease before `latest`; promotion requires the release
   gates below to stay green for the agreed soak period.

## Verification matrix

Required on every change:

- lint and static checks;
- browser-free protocol/configuration tests;
- deterministic browser tests on the pinned Chrome for Testing build;
- package-install smoke test using the packed artifact.

Required in CI:

- macOS, Linux, and Windows for browser selection and temporary-profile cleanup;
- each supported Node release, starting at the declared minimum;
- system stable Chrome as a compatibility smoke test;
- current pinned Chrome for Testing as the release-blocking suite.

Required stress and security cases:

- 100 reloads during bridge initialization;
- 100 rapid launch/close cycles with zero leaked processes or owned profiles;
- concurrent loads in separate windows;
- browser closure during navigation and during an RPC call;
- encoded traversal, malformed percent escapes, symlinks, and symlink replacement;
- cross-origin top-level navigation, iframes, and popup attempts against the bridge;
- permission denial by default and explicit permission grants;
- invalid browser choice, missing build, corrupted cache entry, and profile lock.

Tests assert observable results through module interfaces. They do not copy the
implementation, inspect private fields, or turn failures into accepted error pages.

## Dependency and release policy

- Pin Puppeteer Core exactly for the initial revival. Do not use a caret while the
  browser lifecycle and CDP-dependent features are being stabilized.
- Pin one compatible Chrome for Testing build owned by Carlo and update it together
  with Puppeteer after the complete browser suite passes.
- Keep the direct `@puppeteer/browsers` version aligned with the selected Puppeteer
  release. The initial dependency cleanup removed the old 2.13.2/3.2.2 split.
- Keep runtime dependencies minimal. `mime-types` is reasonable if `ContentRouter`
  retains it; the need for `debug` should be reassessed once errors are structured.
- Never perform a browser download from package installation or normal application
  launch.

## Milestone commit sequence

Each item is a separately green, reviewable commit or small commit series:

1. characterize retained and removed Carlo behavior;
2. make integration failures finite and actionable;
3. replace browser selection with Puppeteer public interfaces;
4. separate browser cache and profile ownership;
5. replace content routing and navigation;
6. replace document RPC with the generation-aware bridge;
7. reduce and verify window features;
8. replace examples and documentation;
9. verify packed-package installation and prerelease automation.

Delete the superseded code in the same milestone that installs its passing
replacement. Do not keep parallel “legacy” and “modern” implementations.

## Definition of done

Carlo is modernized when:

- every documented promise settles successfully or rejects within a documented
  finite bound;
- browser selection uses only public Puppeteer interfaces and deterministic policy;
- temporary resources are cleaned and persistent resources remain persistent;
- reloads and concurrent windows cannot corrupt bridge state;
- Node capabilities are unavailable outside the trusted application document;
- retained filesystem behavior survives adversarial path tests;
- all supported OS/Node/browser jobs pass from a clean checkout;
- the packed package works in an empty consumer project;
- documentation describes only behavior enforced by tests;
- no current module remains solely because deleting old code felt risky.
