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

const debugServer = require('debug')('carlo:server');

/**
 * Intercepted request instance that can be resolved to the client's liking using CDP Fetch domain.
 */
class HttpRequest {
  /**
   * @param {!CDPSession} session
   * @param {!Object} params
   * @param {!Array<function(!HttpRequest)>} handlers
   */
  constructor(session, params, handlers) {
    this.session_ = session;
    this.params_ = params;
    this.handlers_ = handlers;
    this.done_ = false;
    this.callNextHandler_();
  }

  /**
   * @return {string}
   */
  url() {
    return this.params_.request.url;
  }

  /**
   * @return {string}
   */
  method() {
    return this.params_.request.method;
  }

  /**
   * @return {!Object<string, string>} HTTP request headers.
   */
  headers() {
    return this.params_.request.headers || {};
  }

  /**
   * @return {string}
   */
  resourceType() {
    return this.params_.resourceType;
  }

  /**
   * Aborts the request.
   */
  abort() {
    debugServer('abort', this.url());
    return this.resolveFail_('Aborted');
  }

  /**
   * Fails the request.
   */
  fail() {
    debugServer('fail', this.url());
    return this.resolveFail_('Failed');
  }

  /**
   * Falls through to the next handler.
   */
  continue() {
    debugServer('continue', this.url());
    return this.callNextHandler_();
  }

  /**
   * Continues the request with the provided overrides to the url, method or
   * headers.
   *
   * @param {{url: (string|undefined), method: (string|undefined),
   *     headers: (!Object<string, string>|undefined)}|undefined} overrides
   * Overrides to apply to the request before it hits network.
   */
  deferToBrowser(overrides) {
    debugServer('deferToBrowser', this.url());
    const params = { requestId: this.params_.requestId };
    if (overrides) {
      if (overrides.url) params.url = overrides.url;
      if (overrides.method) params.method = overrides.method;
      if (overrides.headers) {
        params.headers = Object.entries(overrides.headers).map(([name, value]) => ({
          name,
          value: String(value),
        }));
      }
    }
    return this.resolve_('Fetch.continueRequest', params);
  }

  /**
   * Fulfills the request with the given data.
   *
   * @param {{status: number|undefined,
   *          headers: !Object<string,string>|undefined,
   *          body: (!Buffer|string)|undefined}} options
   */
  fulfill({ status = 200, headers, body }) {
    debugServer('fulfill', this.url());
    const responseHeaders = [];
    let hasContentLength = false;

    if (headers) {
      for (const [key, val] of Object.entries(headers)) {
        if (key.toLowerCase() === 'content-length')
          hasContentLength = true;
        responseHeaders.push({ name: key, value: String(val) });
      }
    }

    let bodyBuffer = null;
    if (body !== undefined && body !== null) {
      bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
      if (!hasContentLength)
        responseHeaders.push({ name: 'Content-Length', value: String(bodyBuffer.byteLength) });

    }

    const params = {
      requestId: this.params_.requestId,
      responseCode: status,
      responseHeaders,
      body: bodyBuffer ? bodyBuffer.toString('base64') : '',
    };
    return this.resolve_('Fetch.fulfillRequest', params);
  }

  callNextHandler_() {
    debugServer('next handler', this.url());
    const handler = this.handlers_.shift();
    if (handler) {
      try {
        handler(this);
      } catch (e) {
        debugServer('error in request handler', e);
        this.fail();
      }
      return;
    }
    this.deferToBrowser();
  }

  /**
   * @param {string} command
   * @param {!Object} params
   */
  async resolve_(command, params) {
    if (this.done_)
      throw new Error('Already resolved given request');

    this.done_ = true;
    try {
      return await this.session_.send(command, params);
    } catch (e) {
      debugServer('error resolving request:', e.message);
    }
  }

  /**
   * @param {string} errorReason
   */
  async resolveFail_(errorReason) {
    if (this.done_)
      throw new Error('Already resolved given request');

    this.done_ = true;
    try {
      return await this.session_.send('Fetch.failRequest', {
        requestId: this.params_.requestId,
        errorReason,
      });
    } catch (e) {
      debugServer('error failing request:', e.message);
    }
  }
}

module.exports = { HttpRequest };
