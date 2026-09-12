# Carlo v1 product brief

Status: proposed
Date: 2026-09-12

## Thesis

Carlo should be the smallest dependable way to run a trusted local web application
in the user's installed Chrome while giving that application an explicit set of
Node capabilities.

The product earns its place between a normal website and Electron:

- unlike a website, it can call application-owned Node capabilities;
- unlike Electron, it does not bundle another browser;
- unlike raw Puppeteer, it owns application origin, readiness, capability security,
  profile lifetime, window lifetime, and cleanup as one coherent operation.

Carlo v1 is a clean major release. Carlo 0.9 is historical evidence, not a
compatibility requirement.

## Target user

A Node developer building a trusted desktop-like tool, visualization, internal app,
or local companion UI who:

- is comfortable shipping web assets;
- wants an installed Chrome or an explicitly provisioned Chrome for Testing;
- needs a small number of deliberate Node capabilities in the page;
- does not need Electron packaging, Chromium patching, or deep OS integration.

The primary user is not building an untrusted browser, a general web crawler, or a
multi-tenant content host.

## Core job

> Given one application identity, one trusted entry document, and a map of Node
> capabilities, open a usable Chrome application window and own it until shutdown.

The common caller should be declarative:

```js
import {launch} from 'carlo';

const app = await launch({
  id: 'dev.example.system-info',
  entry: new URL('./web/index.html', import.meta.url),
  capabilities: {
    environment: () => ({
      platform: process.platform,
      versions: process.versions,
    }),
  },
});

await app.closed;
```

The page receives one frozen namespace:

```js
const environment = await carlo.capabilities.environment();
```

There is no required `launch → serve → expose → load` sequence.

## Product principles

### One operation owns readiness

`launch()` does not resolve until Chrome is running, the initial document is the
expected trusted document, and its capability bridge is ready. The caller never
coordinates intermediate modules.

### Capabilities, not ambient Node

The page receives only functions named in `capabilities`. It never receives Node
globals, filesystem access, a generic require/import mechanism, or arbitrary Node
object handles.

### Deterministic by default

Normal launch does not download a browser, search arbitrary filesystem trees, change
browser choice after a failure, or silently switch profiles. Failures preserve their
causes and name the remedy.

### Own what we create

While its Node process remains alive, Carlo removes every temporary profile and
terminates every observable browser process it owns. Caller-owned persistent
profiles are never removed. The specification states the unavoidable host-crash
limits.

### Narrow stable interface, explicit instability

Carlo does not mirror Puppeteer's large interface. A Puppeteer escape hatch may be
offered only from an explicitly unstable package subpath after real use cases justify
it.

### Modern means maintained

Carlo targets maintained Node, Puppeteer, ESLint, and browser releases. Dependencies
are updated as one tested set. “Old behavior requires an old dependency” is a reason
to delete or redesign that behavior.

## v1 scope

Required for v1:

- declarative launch of one trusted local `file:` entry document;
- installed stable Chrome by default;
- explicit Chrome channel and executable-path choices;
- explicit, offline managed-Chrome selection after a separate install command;
- temporary profiles by default and explicit persistent profiles;
- named async Node capabilities with JSON-compatible arguments and results;
- reload-safe document generations;
- one initial window plus deterministic multi-window creation;
- close, closed, evaluate, application navigation, and basic window state;
- opt-in browser permissions;
- headless execution through the same interface for tests;
- a loopback development-server entry mode;
- ESM package output, TypeScript source, and generated declarations;
- packed-package consumer tests on every supported platform.

The first usable alpha is intentionally smaller: one local entry, one window,
temporary profile, named capabilities, and clean shutdown. Multi-window, persistent
profiles, managed browsers, and development-server mode follow behind the same
interface before v1 stable.

## Explicit non-goals

Not in v1:

- compatibility with Carlo 0.9 call ordering;
- Electron-compatible packaging, branding, menus, tray, auto-update, or code signing;
- arbitrary remote top-level websites with Node capabilities;
- general request interception or a public `HttpRequest` abstraction;
- transparent distributed objects, prototype transfer, or cross-process RPC;
- child-process terminal orchestration;
- automatic browser downloads during package installation or launch;
- arbitrary Chromium discovery or PATH crawling;
- browser-profile reuse across separate Carlo processes;
- dock icons or platform features without supported-platform tests;
- protection from a same-user attacker who can mutate trusted application files
  while Carlo is reading them.

## Success measures

### Usability

- The complete common example fits in 15 lines of Node code excluding capability
  bodies.
- A fresh consumer can install the packed package, launch the example, call one
  capability, and close cleanly without repository-relative imports.
- No stable interface method exists only for tests.

### Reliability

- Every Carlo-owned startup, navigation, handshake, and shutdown operation settles
  within its documented timeout.
- 100 consecutive launch/close cycles leave zero owned Chrome processes and zero
  temporary profiles.
- 100 reloads during bridge initialization complete without a lost call or hung
  promise.
- Concurrent windows cannot exchange document generations, calls, or capability
  results.
- Closing or crashing Chrome retires every pending Carlo operation exactly once.

### Security

- Node capabilities exist only in the trusted top-level application document.
- Cross-origin documents, popups before adoption, and all iframes lack capabilities.
- Browser permissions are denied unless explicitly granted.
- Local content rejects malformed paths, traversal, and resolved symlink escape.
- Capability errors sent to the page contain stable codes and safe messages, not
  Node stacks or arbitrary internal details.

### Operational quality

- Package installation and normal launch perform no browser download.
- The deterministic suite uses one exact Chrome for Testing build paired with one
  exact Puppeteer version.
- System stable Chrome is exercised as a compatibility smoke test.
- The packed artifact passes on macOS, Linux, and Windows for every supported Node
  release.
- Carlo's measured orchestration overhead is reported separately from Chrome startup
  time and has a regression budget before v1 release.

## Release posture

The first public release is `1.0.0-alpha.1`, not `latest`. Promotion proceeds through
alpha, beta, and release-candidate gates defined in
[MODERNIZATION_PLAN.md](./MODERNIZATION_PLAN.md). Normative behavior lives in
[SPEC.md](./SPEC.md).
