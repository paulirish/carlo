import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {carloError, CarloError, type CarloErrorCode} from '../errors.js';
import {withDeadline} from './deadline.js';
import type {ChromeDriver, ChromeLaunchRequest, ChromeSession} from './driver.js';

export interface HarnessOptions {
  readonly entry: URL;
  readonly request: Omit<ChromeLaunchRequest, 'profilePath'> & {readonly profilePath?: string};
  readonly startupTimeoutMs: number;
  readonly navigationTimeoutMs: number;
  readonly shutdownTimeoutMs?: number;
}

export interface RunningApplication {
  readonly processId: number | undefined;
  readonly disconnected: Promise<void>;
  /** Private test observation for Carlo-owned resource assertions. */
  readonly profilePath: string;
  close(): Promise<void>;
}

async function disconnected<T>(session: ChromeSession, work: Promise<T>, operation: string): Promise<T> {
  const death = session.disconnected.then(cause => {
    throw carloError('ERR_BROWSER_CLOSED', operation, 'Chrome disconnected before the operation completed', cause);
  });
  return await Promise.race([work, death]);
}

async function removeTemporaryProfile(profilePath: string): Promise<void> {
  await rm(profilePath, {recursive: true, force: true, maxRetries: 3});
}

async function cleanup(
  session: ChromeSession | undefined,
  profilePath: string,
  timeoutMs: number,
  removeProfile: boolean,
): Promise<void> {
  let browserFailure: unknown;
  if (session !== undefined) {
    try {
      await withDeadline(session.closeGracefully(), timeoutMs, 'ERR_CLEANUP_FAILED', 'cleanup.browser-close');
    } catch (closeFailure) {
      browserFailure = closeFailure;
      try {
        await withDeadline(session.terminate(), timeoutMs, 'ERR_CLEANUP_FAILED', 'cleanup.browser-terminate');
      } catch (terminateFailure) {
        browserFailure = carloError(
          'ERR_CLEANUP_FAILED', 'cleanup.browser-terminate',
          'Chrome did not terminate after graceful shutdown failed', terminateFailure,
          {gracefulCloseFailed: true},
        );
      }
    }
  }

  let profileFailure: unknown | undefined;
  if (removeProfile) {
    try {
      await withDeadline(removeTemporaryProfile(profilePath), timeoutMs, 'ERR_CLEANUP_FAILED', 'cleanup.profile');
    } catch (error) {
      profileFailure = error;
    }
  }

  if (profileFailure !== undefined)
    throw carloError('ERR_CLEANUP_FAILED', 'cleanup.profile', 'Temporary profile cleanup failed', profileFailure, {
      browserCleanupFailed: browserFailure !== undefined,
    });
  if (browserFailure !== undefined)
    throw carloError('ERR_CLEANUP_FAILED', 'cleanup.browser-close', 'Chrome cleanup failed', browserFailure);
}

function mapped(error: unknown, code: CarloErrorCode, operation: string, message: string): CarloError {
  return error instanceof CarloError ? error : carloError(code, operation, message, error);
}

export async function launchWithDriver(driver: ChromeDriver, options: HarnessOptions): Promise<RunningApplication> {
  const ownsProfile = options.request.profilePath === undefined;
  const profilePath = options.request.profilePath ?? await withDeadline(
    mkdtemp(join(tmpdir(), 'carlo-')), options.startupTimeoutMs,
    'ERR_BROWSER_LAUNCH_FAILED', 'launch.profile',
  );
  const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 10_000;
  let session: ChromeSession | undefined;
  try {
    session = await withDeadline(
      driver.launchChrome({...options.request, profilePath, startupTimeoutMs: options.startupTimeoutMs}), options.startupTimeoutMs,
      'ERR_BROWSER_LAUNCH_FAILED', 'launch.browser',
    ).catch(error => { throw mapped(error, 'ERR_BROWSER_LAUNCH_FAILED', 'launch.browser', 'Chrome failed to launch'); });
    await withDeadline(
      disconnected(session, session.navigateInitialDocument(options.entry.href), 'launch.navigation'),
      options.navigationTimeoutMs, 'ERR_NAVIGATION_TIMEOUT', 'launch.navigation',
    ).catch(error => { throw mapped(error, 'ERR_NAVIGATION_FAILED', 'launch.navigation', 'Initial navigation failed'); });
    await withDeadline(
      disconnected(session, session.waitForBridgeReady(), 'launch.bridge'),
      options.navigationTimeoutMs, 'ERR_BRIDGE_INIT_FAILED', 'launch.bridge',
    ).catch(error => { throw mapped(error, 'ERR_BRIDGE_INIT_FAILED', 'launch.bridge', 'Document bridge failed to become ready'); });
  } catch (error) {
    try {
      await cleanup(session, profilePath, shutdownTimeoutMs, ownsProfile);
    } catch (cleanupError) {
      throw carloError('ERR_CLEANUP_FAILED', 'launch.cleanup', 'Launch failed and cleanup also failed', cleanupError, {
        launchFailed: true,
      });
    }
    throw error;
  }

  let closing: Promise<void> | undefined;
  const activeSession = session;
  return {
    processId: activeSession.processId,
    disconnected: activeSession.disconnected.then(() => {}),
    profilePath,
    close() {
      closing ??= cleanup(activeSession, profilePath, shutdownTimeoutMs, ownsProfile);
      return closing;
    },
  };
}
