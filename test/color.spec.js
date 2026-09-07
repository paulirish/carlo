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

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Color } = require('../lib/color');

describe('color', () => {
  it('rgb1', () => {
    const color = Color.parse('rgb(94, 126, 91)');
    assert.equal(color.asString(Color.Format.RGB), 'rgb(94, 126, 91)');
    assert.equal(color.asString(Color.Format.RGBA), 'rgba(94, 126, 91, 1)');
    assert.equal(color.asString(Color.Format.HSL), 'hsl(115, 16%, 43%)');
    assert.equal(color.asString(Color.Format.HSLA), 'hsla(115, 16%, 43%, 1)');
    assert.equal(color.asString(Color.Format.HEXA), '#5e7e5bff');
    assert.equal(color.asString(Color.Format.HEX), '#5e7e5b');
    assert.equal(color.asString(Color.Format.ShortHEXA), null);
    assert.equal(color.asString(Color.Format.ShortHEX), null);
    assert.equal(color.asString(), 'rgb(94, 126, 91)');
  });

  it('rgb2', () => {
    const color = Color.parse('rgba(94 126 91)');
    assert.equal(color.asString(Color.Format.RGB), 'rgba(94 126 91)');
    assert.equal(color.asString(Color.Format.RGBA), 'rgba(94, 126, 91, 1)');
    assert.equal(color.asString(Color.Format.HSL), 'hsl(115, 16%, 43%)');
    assert.equal(color.asString(Color.Format.HSLA), 'hsla(115, 16%, 43%, 1)');
    assert.equal(color.asString(Color.Format.HEXA), '#5e7e5bff');
    assert.equal(color.asString(Color.Format.HEX), '#5e7e5b');
    assert.equal(color.asString(Color.Format.ShortHEXA), null);
    assert.equal(color.asString(Color.Format.ShortHEX), null);
    assert.equal(color.asString(), 'rgb(94, 126, 91)');
  });

  it('rgb3', () => {
    const color = Color.parse('rgba(94, 126, 91, 0.5)');
    assert.equal(color.asString(Color.Format.RGB), null);
    assert.equal(color.asString(Color.Format.RGBA), 'rgba(94, 126, 91, 0.5)');
    assert.equal(color.asString(Color.Format.HSL), null);
    assert.equal(color.asString(Color.Format.HSLA), 'hsla(115, 16%, 43%, 0.5)');
    assert.equal(color.asString(Color.Format.HEXA), '#5e7e5b80');
    assert.equal(color.asString(Color.Format.HEX), null);
    assert.equal(color.asString(Color.Format.ShortHEXA), null);
    assert.equal(color.asString(Color.Format.ShortHEX), null);
    assert.equal(color.asString(), 'rgba(94, 126, 91, 0.5)');
  });

  it('rgb4', () => {
    const color = Color.parse('rgb(94 126 91 / 50%)');
    assert.equal(color.asString(Color.Format.RGB), null);
    assert.equal(color.asString(Color.Format.RGBA), 'rgb(94 126 91 / 50%)');
    assert.equal(color.asString(Color.Format.HSL), null);
    assert.equal(color.asString(Color.Format.HSLA), 'hsla(115, 16%, 43%, 0.5)');
    assert.equal(color.asString(Color.Format.HEXA), '#5e7e5b80');
    assert.equal(color.asString(Color.Format.HEX), null);
    assert.equal(color.asString(Color.Format.ShortHEXA), null);
    assert.equal(color.asString(Color.Format.ShortHEX), null);
    assert.equal(color.asString(), 'rgba(94, 126, 91, 0.5)');
  });

  it('hsl1', () => {
    const color = Color.parse('hsl(212, 55%, 32%)');
    assert.equal(color.asString(Color.Format.RGB), 'rgb(37, 79, 126)');
    assert.equal(color.asString(Color.Format.RGBA), 'rgba(37, 79, 126, 1)');
    assert.equal(color.asString(Color.Format.HSL), 'hsl(212, 55%, 32%)');
    assert.equal(color.asString(Color.Format.HSLA), 'hsla(212, 55%, 32%, 1)');
    assert.equal(color.asString(Color.Format.HEXA), '#254f7eff');
    assert.equal(color.asString(Color.Format.HEX), '#254f7e');
    assert.equal(color.asString(Color.Format.ShortHEXA), null);
    assert.equal(color.asString(Color.Format.ShortHEX), null);
    assert.equal(color.asString(), 'hsl(212, 55%, 32%)');
  });

  it('hex1', () => {
    const color = Color.parse('#12345678');
    assert.equal(color.asString(Color.Format.RGB), null);
    assert.equal(color.asString(Color.Format.RGBA), 'rgba(18, 52, 86, 0.47058823529411764)');
    assert.equal(color.asString(Color.Format.HSL), null);
    assert.equal(color.asString(Color.Format.HSLA), 'hsla(210, 65%, 20%, 0.47058823529411764)');
    assert.equal(color.asString(Color.Format.HEXA), '#12345678');
    assert.equal(color.asString(Color.Format.HEX), null);
    assert.equal(color.asString(Color.Format.ShortHEXA), null);
    assert.equal(color.asString(Color.Format.ShortHEX), null);
    assert.equal(color.asString(), '#12345678');
  });

  it('hex2', () => {
    const color = Color.parse('#00FFFF');
    assert.equal(color.asString(Color.Format.RGB), 'rgb(0, 255, 255)');
    assert.equal(color.asString(Color.Format.RGBA), 'rgba(0, 255, 255, 1)');
    assert.equal(color.asString(Color.Format.HSL), 'hsl(180, 100%, 50%)');
    assert.equal(color.asString(Color.Format.HSLA), 'hsla(180, 100%, 50%, 1)');
    assert.equal(color.asString(Color.Format.HEXA), '#00ffffff');
    assert.equal(color.asString(Color.Format.HEX), '#00FFFF');
    assert.equal(color.asString(Color.Format.ShortHEXA), '#0fff');
    assert.equal(color.asString(Color.Format.ShortHEX), '#0ff');
    assert.equal(color.asString(), '#00ffff');
  });
});
