/** The private seam contains tasks Carlo performs, not Puppeteer objects. */
export interface ChromeLaunchRequest {
  readonly executablePath?: string;
  readonly channel?: 'chrome' | 'chrome-beta' | 'chrome-dev' | 'chrome-canary';
  readonly profilePath: string;
  readonly headless: boolean;
  readonly startupTimeoutMs: number;
}

export interface ChromeSession {
  readonly disconnected: Promise<unknown>;
  readonly processId: number | undefined;
  navigateInitialDocument(url: string): Promise<void>;
  waitForBridgeReady(): Promise<void>;
  closeGracefully(): Promise<void>;
  terminate(): Promise<void>;
}

export interface ChromeDriver {
  launchChrome(request: ChromeLaunchRequest): Promise<ChromeSession>;
}
