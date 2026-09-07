/**
 * Copyright 2018 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Color } = require('../lib/color');

describe('color', () => {
  it('rgb1', async() => {
    const color = Color.parse('rgb(94, 126, 91)');
    assert.strictEqual(color.asString(Color.Format.RGB), 'rgb(94, 126, 91)');
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgba(94, 126, 91, 1)');
    assert.strictEqual(color.asString(Color.Format.HSL), 'hsl(115, 16%, 43%)');
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(115, 16%, 43%, 1)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#5e7e5bff');
    assert.strictEqual(color.asString(Color.Format.HEX), '#5e7e5b');
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEX), null);
    assert.strictEqual(color.asString(), 'rgb(94, 126, 91)');
  });

  it('rgb2', async() => {
    const color = Color.parse('rgba(94 126 91)');
    assert.strictEqual(color.asString(Color.Format.RGB), 'rgba(94 126 91)');
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgba(94, 126, 91, 1)');
    assert.strictEqual(color.asString(Color.Format.HSL), 'hsl(115, 16%, 43%)');
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(115, 16%, 43%, 1)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#5e7e5bff');
    assert.strictEqual(color.asString(Color.Format.HEX), '#5e7e5b');
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEX), null);
    assert.strictEqual(color.asString(), 'rgb(94, 126, 91)');
  });

  it('rgb3', async() => {
    const color = Color.parse('rgba(94, 126, 91, 0.5)');
    assert.strictEqual(color.asString(Color.Format.RGB), null);
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgba(94, 126, 91, 0.5)');
    assert.strictEqual(color.asString(Color.Format.HSL), null);
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(115, 16%, 43%, 0.5)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#5e7e5b80');
    assert.strictEqual(color.asString(Color.Format.HEX), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEX), null);
    assert.strictEqual(color.asString(), 'rgba(94, 126, 91, 0.5)');
  });

  it('rgb4', async() => {
    const color = Color.parse('rgb(94 126 91 / 50%)');
    assert.strictEqual(color.asString(Color.Format.RGB), null);
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgb(94 126 91 / 50%)');
    assert.strictEqual(color.asString(Color.Format.HSL), null);
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(115, 16%, 43%, 0.5)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#5e7e5b80');
    assert.strictEqual(color.asString(Color.Format.HEX), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEX), null);
    assert.strictEqual(color.asString(), 'rgba(94, 126, 91, 0.5)');
  });

  it('hsl1', async() => {
    const color = Color.parse('hsl(212, 55%, 32%)');
    assert.strictEqual(color.asString(Color.Format.RGB), 'rgb(37, 79, 126)');
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgba(37, 79, 126, 1)');
    assert.strictEqual(color.asString(Color.Format.HSL), 'hsl(212, 55%, 32%)');
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(212, 55%, 32%, 1)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#254f7eff');
    assert.strictEqual(color.asString(Color.Format.HEX), '#254f7e');
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEX), null);
    assert.strictEqual(color.asString(), 'hsl(212, 55%, 32%)');
  });

  it('hsl2', async() => {
    const color = Color.parse('hsla(212 55% 32%)');
    assert.strictEqual(color.asString(Color.Format.RGB), 'rgb(37, 79, 126)');
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgba(37, 79, 126, 1)');
    assert.strictEqual(color.asString(Color.Format.HSL), 'hsla(212 55% 32%)');
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(212, 55%, 32%, 1)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#254f7eff');
    assert.strictEqual(color.asString(Color.Format.HEX), '#254f7e');
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEX), null);
    assert.strictEqual(color.asString(), 'hsl(212, 55%, 32%)');
  });

  it('hsl3', async() => {
    const color = Color.parse('hsla(212, 55%, 32%, 0.5)');
    assert.strictEqual(color.asString(Color.Format.RGB), null);
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgba(37, 79, 126, 0.5)');
    assert.strictEqual(color.asString(Color.Format.HSL), null);
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(212, 55%, 32%, 0.5)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#254f7e80');
    assert.strictEqual(color.asString(Color.Format.HEX), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEX), null);
    assert.strictEqual(color.asString(), 'hsla(212, 55%, 32%, 0.5)');
  });

  it('hsl4', async() => {
    const color = Color.parse('hsla(212  55%  32% /  50%)');
    assert.strictEqual(color.asString(Color.Format.RGB), null);
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgba(37, 79, 126, 0.5)');
    assert.strictEqual(color.asString(Color.Format.HSL), null);
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(212  55%  32% /  50%)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#254f7e80');
    assert.strictEqual(color.asString(Color.Format.HEX), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEX), null);
    assert.strictEqual(color.asString(), 'hsla(212, 55%, 32%, 0.5)');
  });

  it('hsl5', async() => {
    const color = Color.parse('hsla(212deg 55% 32% / 50%)');
    assert.strictEqual(color.asString(Color.Format.RGB), null);
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgba(37, 79, 126, 0.5)');
    assert.strictEqual(color.asString(Color.Format.HSL), null);
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(212deg 55% 32% / 50%)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#254f7e80');
    assert.strictEqual(color.asString(Color.Format.HEX), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEX), null);
    assert.strictEqual(color.asString(), 'hsla(212, 55%, 32%, 0.5)');
  });

  it('hex1', async() => {
    const color = Color.parse('#12345678');
    assert.strictEqual(color.asString(Color.Format.RGB), null);
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgba(18, 52, 86, 0.47058823529411764)');
    assert.strictEqual(color.asString(Color.Format.HSL), null);
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(210, 65%, 20%, 0.47058823529411764)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#12345678');
    assert.strictEqual(color.asString(Color.Format.HEX), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEX), null);
    assert.strictEqual(color.asString(), '#12345678');
  });

  it('hex2', async() => {
    const color = Color.parse('#00FFFF');
    assert.strictEqual(color.asString(Color.Format.RGB), 'rgb(0, 255, 255)');
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgba(0, 255, 255, 1)');
    assert.strictEqual(color.asString(Color.Format.HSL), 'hsl(180, 100%, 50%)');
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(180, 100%, 50%, 1)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#00ffffff');
    assert.strictEqual(color.asString(Color.Format.HEX), '#00FFFF');
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), '#0fff');
    assert.strictEqual(color.asString(Color.Format.ShortHEX), '#0ff');
    assert.strictEqual(color.asString(), '#00ffff');
  });

  it('hex3', async() => {
    const color = Color.parse('#1234');
    assert.strictEqual(color.asString(Color.Format.RGB), null);
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgba(17, 34, 51, 0.26666666666666666)');
    assert.strictEqual(color.asString(Color.Format.HSL), null);
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(210, 50%, 13%, 0.26666666666666666)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#11223344');
    assert.strictEqual(color.asString(Color.Format.HEX), null);
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), '#1234');
    assert.strictEqual(color.asString(Color.Format.ShortHEX), null);
    assert.strictEqual(color.asString(), '#1234');
  });

  it('hex4', async() => {
    const color = Color.parse('#0FF');
    assert.strictEqual(color.asString(Color.Format.RGB), 'rgb(0, 255, 255)');
    assert.strictEqual(color.asString(Color.Format.RGBA), 'rgba(0, 255, 255, 1)');
    assert.strictEqual(color.asString(Color.Format.HSL), 'hsl(180, 100%, 50%)');
    assert.strictEqual(color.asString(Color.Format.HSLA), 'hsla(180, 100%, 50%, 1)');
    assert.strictEqual(color.asString(Color.Format.HEXA), '#00ffffff');
    assert.strictEqual(color.asString(Color.Format.HEX), '#00ffff');
    assert.strictEqual(color.asString(Color.Format.ShortHEXA), '#0fff');
    assert.strictEqual(color.asString(Color.Format.ShortHEX), '#0FF');
    assert.strictEqual(color.asString(), '#0ff');
  });
});
