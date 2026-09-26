import type {ChromeDriver, ChromeLaunchRequest, ChromeSession} from './driver.js';

type Task = 'launch' | 'navigate' | 'bridge' | 'close' | 'terminate';
export type ScriptedOutcome = 'ok' | 'hang' | {readonly fail: unknown} | {readonly delayMs: number};
export type Script = Partial<Record<Task, ScriptedOutcome>> & {readonly disconnectAt?: Task};

export class ScriptedChromeDriver implements ChromeDriver {
  readonly calls: Task[] = [];
  readonly #script: Script;
  readonly #disconnect: Promise<unknown>;
  #disconnectNow!: (reason?: unknown) => void;

  constructor(script: Script = {}) {
    this.#script = script;
    this.#disconnect = new Promise(resolve => { this.#disconnectNow = resolve; });
  }

  async #run(task: Task): Promise<void> {
    this.calls.push(task);
    if (this.#script.disconnectAt === task) this.#disconnectNow(new Error(`scripted disconnect during ${task}`));
    const outcome = this.#script[task] ?? 'ok';
    if (outcome === 'hang') return await new Promise(() => {});
    if (typeof outcome === 'object' && 'fail' in outcome) throw outcome.fail;
    if (typeof outcome === 'object') await new Promise(resolve => setTimeout(resolve, outcome.delayMs));
  }

  async launchChrome(_request: ChromeLaunchRequest): Promise<ChromeSession> {
    await this.#run('launch');
    return {
      disconnected: this.#disconnect,
      processId: 4242,
      navigateInitialDocument: async() => await this.#run('navigate'),
      waitForBridgeReady: async() => await this.#run('bridge'),
      closeGracefully: async() => await this.#run('close'),
      terminate: async() => await this.#run('terminate'),
    };
  }
}
