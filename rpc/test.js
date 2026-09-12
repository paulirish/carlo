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

/* global c */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const rpc = require('./rpc');

async function createChildWorld(rpcInstance, initializer, ...args) {
  let sendToParent;
  let sendToChild;
  function transport1(receivedFromChild) {
    sendToParent = receivedFromChild;
    return data => setTimeout(() => sendToChild(data), 0);
  }
  function transport2(receivedFromParent) {
    sendToChild = receivedFromParent;
    return data => setTimeout(() => sendToParent(data), 0);
  }
  const childRpc = new rpcInstance.constructor();
  childRpc.initWorld(transport2, p => initializer(p, childRpc));
  await rpcInstance.createWorld(transport1, ...args);
  return childRpc;
}

describe('rpc', () => {
  it('call method', async() => {
    class Foo {
      sum(a, b) { return a + b; }
    }
    const foo = rpc.handle(new Foo());
    assert.equal(await foo.sum(1, 3), 4);
  });

  it('call method with object', async() => {
    class Foo {
      sum(a, b) { return { value: a.value + b.value }; }
    }
    const foo = rpc.handle(new Foo());
    const result = await foo.sum({ value: 1 }, { value: 3 });
    assert.equal(result.value, 4);
  });

  it('call method with array', async() => {
    class Foo {
      sum(arr) { return arr.reduce((a, c) => a + c, 0); }
    }
    const foo = rpc.handle(new Foo());
    const result = await foo.sum([1, 2, 3, 4, 5]);
    assert.equal(result, 15);
  });

  it('call method with objects with handles', async() => {
    class Foo {
      async call(val) { return await val.a[0].name(); }
      name() { return 'name'; }
    }
    const foo = rpc.handle(new Foo());
    const result = await foo.call({ a: [foo] });
    assert.equal(result, 'name');
  });

  it('call method with object with recursive link', async() => {
    class Foo {
      async call(val) { return await val.a[0].name(); }
      name() { return 'name'; }
    }
    const foo = rpc.handle(new Foo());
    const a = {};
    a.a = a;
    await assert.rejects(
        async() => { await foo.call({ a }); },
        /Object reference chain is too long/
    );
  });

  it('call method that does not exist', async() => {
    class Foo {}
    const foo = rpc.handle(new Foo());
    await assert.rejects(
        async() => { await foo.sum(1, 3); },
        /There is no member/
    );
  });

  it('call private method', async() => {
    const foo = rpc.handle({});
    await assert.rejects(
        async() => { await foo._sum(1, 3); },
        /Private members are not exposed over RPC/
    );
  });

  it('call method exception', async() => {
    class Foo {
      sum(a, b) { return b + c; }
    }
    const foo = rpc.handle(new Foo());
    await assert.rejects(
        async() => { await foo.sum(1, 3); },
        /c is not defined/
    );
  });

  it('handle to function', async() => {
    class Foo {
      call(callback) { return callback(); }
    }
    const foo = rpc.handle(new Foo());
    let calls = 0;
    await foo.call(rpc.handle(() => ++calls));
    assert.equal(calls, 1);
  });

  it('access property', async() => {
    const foo = rpc.handle({ value: 'Hello world' });
    assert.equal(await foo.value(), 'Hello world');
  });

  it('materialize handle', async() => {
    const object = {};
    const handle = rpc.handle(object);
    assert.equal(rpc.object(handle), object);
  });

  it('access disposed handle', async() => {
    class Foo {
      sum(a, b) { return a + b; }
    }
    const foo = rpc.handle(new Foo());
    rpc.dispose(foo);
    await assert.rejects(
        async() => { await foo.sum(1, 2); },
        /Object has been diposed/
    );
  });

  it('parent / child communication', async() => {
    const messages = [];
    class Root { hello(message) { messages.push(message); } }
    const root = rpc.handle(new Root());
    await createChildWorld(rpc, p => p.hello('one'), root);
    await createChildWorld(rpc, p => p.hello('two'), root);
    assert.equal(messages.join(','), 'one,two');
  });

  it('dispose world', async() => {
    const messages = [];
    class Root { hello(message) { messages.push(message); } }
    const root = rpc.handle(new Root());
    let childRoot;
    const childRpc = await createChildWorld(rpc, r => childRoot = r, root);
    childRoot.hello('hello');

    await new Promise(f => setTimeout(f, 20));
    rpc.disposeWorld(childRpc.worldId_);

    childRoot.hello('hello');
    await new Promise(f => setTimeout(f, 20));

    assert.equal(messages.join(','), 'hello');
  });
});
