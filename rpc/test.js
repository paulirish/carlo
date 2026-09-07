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
const rpc = require('./rpc');

async function createChildWorld(rpc, initializer, ...args) {
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
  const childRpc = new rpc.constructor();
  childRpc.initWorld(transport2, p => initializer(p, childRpc));
  await rpc.createWorld(transport1, ...args);
  return childRpc;
}

describe('rpc', () => {
  it('call method', async() => {
    class Foo {
      sum(a, b) { return a + b; }
    }
    const foo = rpc.handle(new Foo());
    assert.strictEqual(await foo.sum(1, 3), 4);
  });

  it('call method with object', async() => {
    class Foo {
      sum(a, b) { return { value: a.value + b.value }; }
    }
    const foo = rpc.handle(new Foo());
    const result = await foo.sum({value: 1}, {value: 3});
    assert.strictEqual(result.value, 4);
  });

  it('call method with array', async() => {
    class Foo {
      sum(arr) { return arr.reduce((a, c) => a + c, 0); }
    }
    const foo = rpc.handle(new Foo());
    const result = await foo.sum([1, 2, 3, 4, 5]);
    assert.strictEqual(result, 15);
  });

  it('call method with objects with handles', async() => {
    class Foo {
      async call(val) { return await val.a[0].name(); }
      name() { return 'name'; }
    }
    const foo = rpc.handle(new Foo());
    const result = await foo.call({a: [foo]});
    assert.strictEqual(result, 'name');
  });

  it('call method with object with recursive link', async() => {
    class Foo {
      async call(val) { return await val.a[0].name(); }
      name() { return 'name'; }
    }
    const foo = rpc.handle(new Foo());
    const a = {};
    a.a = a;
    await assert.rejects(async() => {
      await foo.call({a});
    }, { message: 'Object reference chain is too long' });
  });

  it('call method that does not exist', async() => {
    class Foo {}
    const foo = rpc.handle(new Foo());
    await assert.rejects(async() => {
      await foo.sum(1, 3);
    }, /There is no member/);
  });

  it('call private method', async() => {
    const foo = rpc.handle({});
    await assert.rejects(async() => {
      await foo._sum(1, 3);
    }, /Private members are not exposed over RPC/);
  });

  it('call method exception', async() => {
    class Foo {
      sum(a, b) { return b + c; }
    }
    const foo = rpc.handle(new Foo());
    await assert.rejects(async() => {
      await foo.sum(1, 3);
    }, /c is not defined/);
  });

  it('call nested exception', async() => {
    class Foo {
      sum(a, b) { return rpc.handle(this).doSum(a, b); }
      doSum(a, b) { return b + c; }
    }
    const foo = rpc.handle(new Foo());
    await assert.rejects(async() => {
      await foo.sum(1, 3);
    }, /c is not defined/);
  });

  it('handle to function', async() => {
    class Foo {
      call(callback) { return callback(); }
    }
    const foo = rpc.handle(new Foo());
    let calls = 0;
    await foo.call(rpc.handle(() => ++calls));
    assert.strictEqual(calls, 1);
  });

  it('handle to function exception', async() => {
    class Foo {
      call(callback) { return callback(); }
    }
    const foo = rpc.handle(new Foo());
    const calls = 0;
    await assert.rejects(async() => {
      await foo.call(rpc.handle(() => ++calls));
    }, /Assignment to constant/);
  });

  it('access property', async() => {
    const foo = rpc.handle({ value: 'Hello wold' });
    assert.strictEqual(await foo.value(), 'Hello wold');
  });

  it('access property with params', async() => {
    const foo = rpc.handle({ value: 'Hello wold' });
    await assert.rejects(async() => {
      await foo.value(1);
    }, /is not a function/);
  });

  it('materialize handle', async() => {
    const object = {};
    const handle = rpc.handle(object);
    assert.strictEqual(rpc.object(handle), object);
  });

  it('access disposed handle', async() => {
    class Foo {
      sum(a, b) { return b + c; }
    }
    const foo = rpc.handle(new Foo());
    rpc.dispose(foo);
    await assert.rejects(async() => {
      await foo.sum(1, 2);
    }, /Object has been diposed/);
  });

  it('dedupe implicit handles in the same world', async() => {
    let foo2;
    class Foo { foo(f) { foo2 = f; }}
    const foo = rpc.handle(new Foo());
    await foo.foo(foo);
    assert.strictEqual(foo, foo2);
  });

  it('handle to handle should throw', async() => {
    const handle = rpc.handle({});
    assert.throws(() => {
      rpc.handle(handle);
    }, /Can not return handle to handle/);
  });

  it('parent / child communication', async() => {
    const messages = [];
    class Root { hello(message) { messages.push(message); } }
    const root = rpc.handle(new Root());
    await createChildWorld(rpc, p => p.hello('one'), root);
    await createChildWorld(rpc, p => p.hello('two'), root);
    assert.strictEqual(messages.join(','), 'one,two');
  });

  it('parent / grand child communication', async() => {
    const messages = [];
    class Root { hello(message) { messages.push(message); } }
    const root = rpc.handle(new Root());
    await createChildWorld(rpc, async(p, r) => {
      await createChildWorld(r, p => p.hello('one'), p);
    }, root);
    assert.strictEqual(messages.join(','), 'one');
  });

  it('child / child communication', async() => {
    const messages = [];
    class Parent {
      constructor() { this.children_ = []; }
      addChild(child) {
        this.children_.forEach(c => { c.setSibling(child); child.setSibling(c); });
        this.children_.push(child);
      }
    }
    class Child {
      constructor() {}
      setSibling(sibling) {
        sibling.helloSibling('hello');
      }
      helloSibling(message) {
        messages.push(message);
      }
    }
    const parent = rpc.handle(new Parent());
    await createChildWorld(rpc, (p, r) => p.addChild(r.handle(new Child())), parent);
    await createChildWorld(rpc, (p, r) => p.addChild(r.handle(new Child())), parent);
    await new Promise(f => setTimeout(f, 0));
    await new Promise(f => setTimeout(f, 0));
    assert.strictEqual(messages.join(','), 'hello,hello');
  });

  it('dispose world', async() => {
    const messages = [];
    class Root { hello(message) { messages.push(message); } }
    const root = rpc.handle(new Root());
    let childRoot;
    const childRpc = await createChildWorld(rpc, r => childRoot = r, root);
    childRoot.hello('hello');

    await new Promise(f => setTimeout(f, 0));
    rpc.disposeWorld(childRpc.worldId_);

    childRoot.hello('hello');
    await new Promise(f => setTimeout(f, 0));

    assert.strictEqual(messages.join(','), 'hello');
  });

  it('dispose world half way', async() => {
    const messages = [];
    let go;
    class Root {
      hello(message) { messages.push(message); return new Promise(f => go = f); }
    }
    const root = rpc.handle(new Root());
    let childRoot;
    const childRpc = await createChildWorld(rpc, r => childRoot = r, root);
    childRoot.hello('hello').then(() => messages.push('should-not-happen'));
    await new Promise(f => setTimeout(f, 0));
    rpc.disposeWorld(childRpc.worldId_);
    go();
    await new Promise(f => setTimeout(f, 0));
    await new Promise(f => setTimeout(f, 0));
    assert.strictEqual(messages.join(','), 'hello');
  });
});
