import puppeteer, {type Browser, type Page} from 'puppeteer-core';
import type {ChromeDriver, ChromeLaunchRequest, ChromeSession} from './driver.js';

class PuppeteerSession implements ChromeSession {
  readonly disconnected: Promise<unknown>;
  readonly processId: number | undefined;
  readonly #browser: Browser;
  readonly #page: Page;

  constructor(browser: Browser, page: Page) {
    this.#browser = browser;
    this.#page = page;
    this.processId = browser.process()?.pid;
    this.disconnected = new Promise(resolve => browser.once('disconnected', resolve));
  }

  async navigateInitialDocument(url: string): Promise<void> {
    await this.#page.goto(url, {waitUntil: 'domcontentloaded', timeout: 0});
  }

  async waitForBridgeReady(): Promise<void> {
    await this.#page.evaluate(() => document.readyState !== 'loading');
  }

  async closeGracefully(): Promise<void> { await this.#browser.close(); }
  async terminate(): Promise<void> { this.#browser.process()?.kill('SIGKILL'); }
}

export class PuppeteerChromeDriver implements ChromeDriver {
  async launchChrome(request: ChromeLaunchRequest): Promise<ChromeSession> {
    const browser = await puppeteer.launch({
      ...(request.executablePath === undefined ? {} : {executablePath: request.executablePath}),
      ...(request.channel === undefined ? {} : {channel: request.channel}),
      userDataDir: request.profilePath,
      headless: request.headless,
      pipe: true,
      timeout: request.startupTimeoutMs,
      args: process.getuid?.() === 0 ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
    });
    const pages = await browser.pages();
    const page = pages[0] ?? await browser.newPage();
    return new PuppeteerSession(browser, page);
  }
}
