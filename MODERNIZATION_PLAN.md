# Carlo v1 modernization roadmap

Status: proposed
Date: 2026-09-12

This roadmap delivers [PRODUCT.md](./PRODUCT.md) and [SPEC.md](./SPEC.md). It replaces
Carlo 0.9 in vertical slices; it does not repair every legacy module before a late
cutover.

## Executive decision

Build a clean Carlo 1.0 around one deep external module:

> `launch(options)` opens a ready trusted Chrome application and returns the handle
> that owns its windows and lifetime.

The alpha path is one file entry, one window, immutable named capabilities,
temporary profile, and clean shutdown. Multi-window, persistent profiles, loopback
development, and managed browsers are added behind the same interface before v1.

Delete the old setup choreography, general RPC, request interception interface,
browser finder, and stale examples as replacement slices land.

## Why the previous roadmap was insufficient

The earlier plan captured useful audit findings but:

- organized work horizontally around internals, delaying a usable product;
- preserved too much of the 0.9 object model before defining the v1 caller;
- mixed product requirements, normative behavior, architecture, and tasks;
- left consequential feature decisions to future archaeology;
- promised filesystem race guarantees portable Node cannot fully provide;
- lacked precise error, readiness, trust, and lifecycle contracts;
- used test counts as goals without defining observable success.

This revision separates product, specification, and delivery, chooses a clean-major
posture, and makes each milestone produce an executable vertical slice.

## Baseline

As of 2026-09-12:

- upstream Carlo ended in 2020;
- the 2026 port arrived as one bot-assisted Puppeteer/test/interception rewrite;
- Node 25.8 and Chrome for Testing 141 exercise most simple behavior;
- lint and 30 current unit tests pass;
- isolated browser cases pass 20 of 22 behaviors;
- failed navigation resolves as success;
- reload during RPC initialization hangs;
- a prior multi-window failure can make a later test hang despite passing alone;
- temporary profiles leak and browser storage does not persist by default;
- some green tests validate copied algorithms rather than Carlo;
- meaningful historical RPC and parser cases were deleted.

Dependency cleanup is complete:

- current direct registry releases are installed and exact-pinned;
- `puppeteer-core@25.10.0` and `@puppeteer/browsers@3.2.2` are aligned;
- Node is corrected to `>=22.12.0`;
- ESLint 10, `@eslint/js` 10, `globals` 17, and `mime-types` 3 are active;
- `pnpm outdated` reports no stale direct dependency.

## Critical path

```text
ratify v1 contract
        |
deterministic harness and Chrome adapter
        |
single-window lifecycle + trusted local content
        |
generation-aware capability bridge
        |
alpha cutover and legacy deletion
        |
multi-window + persistent profile + development server
        |
managed browser CLI + package verification
        |
beta -> release candidate -> v1
```

Work outside this path does not block alpha unless it invalidates the specification.

## Architecture strategy

### External seam

The stable seam is `launch()` returning `App`. Callers do not construct or sequence
browser, content, bridge, or window modules. Tests primarily cross the same seam.

### True external dependencies

Puppeteer and CDP are true external dependencies. Define one private task-shaped
driver seam after enumerating the operations the first vertical slice needs.

Adapters:

- production Puppeteer adapter;
- scripted adapter for deterministic launch, disconnect, ordering, timeout, and
  cleanup faults.

The seam expresses Carlo operations; it does not copy Puppeteer's `Browser`, `Page`,
`Target`, request, or CDP interfaces. Pinned-Chrome tests remain mandatory because a
scripted adapter cannot detect browser drift.

The filesystem is local-substitutable. Test it with real temporary directories and
files; do not create a caller-visible filesystem adapter.

### Content transport decision

The file entry needs a stable synthetic origin. First prove the required behavior
with Puppeteer's public request interception: documents, subresources, `HEAD`, 404,
navigation rejection, reload, redirects, and exactly-once completion.

If a required operation is missing, document that precise gap and put the minimum
CDP Fetch code inside the Puppeteer adapter. Do not preserve the current general CDP
wrapper by default.

A loopback server is not the initial file transport: a random port changes storage
identity, while a fixed port adds collision and locking behavior.

## Milestones

### M0 — Ratify product and specification

Deliverables:

- review and accept `PRODUCT.md` and `SPEC.md`;
- add a 0.9-to-v1 ledger classifying each export as retain, replace, remove, or defer;
- choose the exact Chrome for Testing build paired with Puppeteer 25.10.0;
- map every v1 invariant to a named black-box test or later milestone.

Exit gate:

- every promise has readiness, success, failure, cancellation, and terminal semantics;
- every 0.9 export has a disposition;
- no later milestone depends on an unresolved stable-interface question.

### M1 — Deterministic harness and package skeleton

Deliverables:

- TypeScript source compiled to ESM JavaScript and declarations;
- package `exports` and an empty packed-consumer fixture;
- finite test and hook timeouts plus the specified Carlo-owned operation deadlines;
- pinned Chrome provisioning for development and CI;
- private task-shaped Chrome driver with Puppeteer and scripted adapters;
- process/profile leak assertions after browser tests;
- centralized `CarloError` creation and cause preservation.

Exit gate:

- broken browser launch, disconnect, and cleanup fail promptly with specified codes;
- the suite cannot hang after a failed hook or test;
- the Puppeteer adapter contract passes against pinned Chrome;
- the packed skeleton imports in an empty Node project.

### M2 — Single-window walking skeleton

This is a repository development slice, not a published alpha. Its packed-consumer
test verifies packaging locally without promising a temporarily weaker public
contract.

Deliverables:

- parse `id`, file entry, system/explicit browser, temporary profile,
  headful/headless display, and window options;
- stable application identity and synthetic origin;
- local document and subresource serving;
- `launch()`, `mainWindow`, `closed`, `close()`, user window close, and cleanup;
- a `DocumentBridge` readiness handshake for the empty capability set, establishing
  the final launch-readiness contract before capability dispatch is added;

Delete now:

- `lib/find_chrome.js`, OS lists, and recursive cache search;
- implicit download and revision/wildcard selection;
- module-global test mode and environment mutation;
- old profile creation.

Exit gate:

- a packed consumer launches a real entry and its assets with one call;
- missing browser/entry, failed navigation, browser death, concurrent close, user
  close, and cleanup failures settle deterministically;
- broken content navigation fails promptly with its specified code;
- 100 launch/close cycles leave no owned process or profile;
- normal launch performs no network request or browser download.

### M3 — Capability bridge and document generations

Deliverables:

- immutable `carlo.capabilities` namespace;
- JSON-value codec and closed message union;
- top-frame/origin enforcement;
- per-window document generations;
- handshake, call correlation, safe error mapping, and retirement;
- `navigate()` whose commit, DOM readiness, and bridge readiness share a generation.

Delete now:

- `rpc/rpc.js`, `rpc/rpc_process.js`, and arbitrary handles;
- `loadParams()` and `paramsForReuse`;
- ambient exposed globals and mutable post-launch exposure;
- evaluated feature injection.

Exit gate:

- early, async, unknown, unsafe-name, invalid-value, and thrown capability calls have
  specified outcomes;
- broken bridge initialization fails promptly with its specified code;
- 100 reloads during handshake pass;
- navigation/close/browser death retire calls once;
- external documents, iframes, and unadopted popups lack capabilities;
- sequential app instances cannot consume retired messages or generations.

Alpha cut: point the prerelease package at the new implementation and delete the
remaining legacy launch path. Never ship parallel legacy/modern modes.

### M4 — Complete the v1 application interface

Deliverables:

- `open()`, window registry, and multi-window lifecycle ordering;
- `evaluate()`, relative navigation, bring-to-front, bounds, and verified states;
- persistent profiles and storage-survival tests;
- explicit permissions;
- loopback development-server entry and origin enforcement.

Delete or defer now:

- app methods that merely repeat window methods;
- public `HttpRequest` and mutable serving setup;
- shortcuts, file-path disclosure, and general color parsing;
- icons and window behavior without supported-platform verification.

Exit gate:

- concurrent open/navigate/close is deterministic;
- simultaneous windows cannot exchange messages, calls, or generations;
- final-window shutdown ordering matches the specification;
- persistent data survives relaunch and a lock never triggers fallback;
- permissions are denied by default and grants are origin-scoped;
- development redirects, disconnects, and origin changes fail explicitly;
- claimed window behavior passes on each supported platform.

### M5 — Browser provisioning and packaging

Deliverables:

- `carlo browser install|path|remove` using public `@puppeteer/browsers`;
- one exact Chrome for Testing build and Carlo-owned cache;
- managed launch without runtime download;
- package exports, declarations, license, file list, and provenance;
- packed-tarball tests in empty consumers;
- minimal local and capability examples importing the packed artifact.

Delete now:

- `scripts/download-browser.js`;
- duplicate or implicit browser cache policy;
- examples using Carlo 0.9, obsolete `pkg`, xterm, or deleted test infrastructure.

Exit gate:

- `path` and `remove` are local and idempotent; `install` is atomic, may require the
  network, and reuses an already complete exact build without a download;
- corrupt or missing managed builds fail without fallback;
- package install and ordinary launch download no browser;
- packed examples pass on the supported OS/Node matrix.

Beta cut: publish only after this gate.

### M6 — Hardening and release candidate

Deliverables:

- complete trust/content and lifecycle stress suites;
- system stable Chrome smoke job;
- measured orchestration overhead and agreed regression budget;
- 0.9 migration guide;
- README and reference aligned with the ratified interface;
- removal of `handoff.md` after its facts become tests or maintained docs;
- dependency, license, and security review.

Exit gate:

- all release gates pass from clean checkouts;
- no documented behavior lacks a black-box test;
- no legacy path or stale example remains;
- no error is logged-and-swallowed;
- release-candidate soak finds no orphan process, profile leak, or indefinite operation.

## Release gates

Every commit after M1:

- lint and typecheck;
- browser-free interface, codec, lifecycle, and option tests;
- pinned Chrome for Testing interface tests;
- zero owned process/profile assertion;
- packed-consumer smoke once a slice is package-visible.

Release-blocking matrix:

- Node 22.12 minimum and each supported newer LTS;
- macOS, Linux, and Windows;
- exact pinned Chrome for Testing;
- system stable Chrome smoke;
- headful application and headless test paths.

Lifecycle stress:

- 100 launch/close cycles and 100 reloads during bridge connection;
- concurrent navigation in multiple windows;
- browser closure during startup, navigation, calls, and cleanup;
- duplicate close and window/application close races;
- locked persistent profile and interrupted launch.

Trust/content:

- malformed encoding, NULs, traversal, and resolved symlink escape;
- missing, directory, and non-regular entries;
- unsupported methods and concurrent subresources;
- external navigation, untrusted redirects, iframes, and popups;
- permission denial and explicit grants;
- development-server disconnect and invalid responses.

Tests cross the stable seam. Internal adapter tests cover only external failures that
are impractical to induce reliably with Chrome. Copied implementation algorithms are
not tests.

## Deletion manifest

| Legacy area | Replacement gate |
| --- | --- |
| `lib/find_chrome.js`, path lists, recursive cache search | M2 |
| leaking random-profile behavior | M2 |
| monolithic legacy launch path | M3 alpha cut |
| `rpc/`, `rpc_process`, load params, handle worlds | M3 |
| evaluated feature injection | M3 |
| `lib/http_request.js`, public request lifecycle | M4 |
| shortcuts, file disclosure, unsupported window features | M4 |
| old download script and stale examples | M5 |
| copied and superseded legacy tests | Same milestone as replacement tests |
| `handoff.md` | M6 |

Git history is the archive. Do not retain dead modules as in-tree reference material.

## Risk register

| Risk | Early proof | Response |
| --- | --- | --- |
| Public interception cannot provide stable-origin behavior | M1/M2 transport spike | Minimal CDP adapter for the proven gap |
| Binding reaches frames or survives navigation incorrectly | M3 attack tests | Scope by execution context or reject design |
| TypeScript/ESM delays browser work | M1 packed skeleton | Use `tsc`; no dual output/bundler without evidence |
| Multi-window recreates global races | M4 simultaneous-window tests | Per-window state; no global protocol registry |
| System Chrome drifts | Separate smoke | Pinned Chrome stays release-blocking |
| File guarantee exceeds portable Node | SPEC trust statement | Protect browser paths; do not claim hostile-local defense |
| Puppeteer escape hatch breaks ownership | Exclude from stable v1 | Separate unstable proposal with conflict tests |
| Legacy compatibility expands scope | Migration ledger | Clean-major rule; re-ratify any exception |

## Decision log

| Decision | Status | Reason |
| --- | --- | --- |
| Clean 1.0, not 0.9 compatibility | Proposed | Pre-1.0 history and permission to delete weak code |
| Declarative launch | Proposed | Removes ordering hazards and deepens the module |
| Named JSON capabilities, no RPC handles | Proposed | Primary job with tractable ownership/security |
| Temporary profile default | Proposed | Safe cleanup and honest persistence |
| System Chrome default; managed explicit | Proposed | Small install without runtime nondeterminism |
| One-window alpha; multi-window before stable | Proposed | Early useful slice before concurrency |
| ESM output from TypeScript | Proposed | Maintained Node and exhaustive protocol types |
| No stable Puppeteer escape hatch | Proposed | Protects ownership and interface depth |
| Trusted app, not XSS sandbox | Proposed | Honest Node-capable content model |

Ratification changes `Proposed` to `Accepted`. Changing an accepted decision requires
updating this table and affected product/spec text in the same commit.

## Definition of done

Carlo v1 is done when:

- the packed common example is declarative and works;
- every stable promise has deterministic terminal behavior;
- browser selection uses public Puppeteer interfaces without fallback cascades;
- temporary resources are absent after every terminal path;
- persistent storage persists and locked profiles fail explicitly;
- reloads and windows cannot corrupt bridge state;
- Node capabilities are absent outside the trusted top-level document;
- all supported OS/Node/pinned-browser jobs pass from clean checkouts;
- system stable Chrome passes its smoke policy;
- documentation contains no untested behavior;
- no legacy module remains merely because deletion felt risky.
