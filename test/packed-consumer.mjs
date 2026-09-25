import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commandOptions = {timeout: 120_000, killSignal: 'SIGKILL'};

test('packed ESM skeleton imports in an empty project', {timeout: 180_000}, () => {
  const work = mkdtempSync(path.join(tmpdir(), 'carlo-consumer-'));
  try {
    const output = execFileSync('npm', ['pack', '--json', '--pack-destination', work], {
      ...commandOptions, cwd: root, encoding: 'utf8',
    });
    const tarball = path.join(work, JSON.parse(output)[0].filename);
    const consumer = path.join(work, 'consumer');
    mkdirSync(consumer);
    writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({
      type: 'module', dependencies: {carlo: `file:${tarball}`},
    }));
    execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
      ...commandOptions, cwd: consumer, stdio: 'pipe',
    });
    const imported = execFileSync(process.execPath, [
      '--input-type=module', '-e',
      "import {launch, CarloError} from 'carlo'; console.log(typeof launch, typeof CarloError)",
    ], {...commandOptions, cwd: consumer, encoding: 'utf8'}).trim();
    assert.equal(imported, 'function function');
  } finally {
    rmSync(work, {recursive: true, force: true});
  }
});
