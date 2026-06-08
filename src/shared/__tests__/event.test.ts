import { describe, it, expect } from 'vitest';
import { Emitter, Event, PauseableEmitter } from '../event';
import { DisposableStore } from '../lifecycle';

describe('Event System', () => {
  it('Emitter event subscription and firing should work', () => {
    const emitter = new Emitter<string>();
    const received: string[] = [];
    const sub = emitter.event(val => received.push(val));
    emitter.fire('hello');
    emitter.fire('world');
    expect(received).toEqual(['hello', 'world']);
    sub.dispose();
    emitter.fire('ignored');
    expect(received).toEqual(['hello', 'world']);
  });

  it('Event.map should work', () => {
    const emitter = new Emitter<number>();
    const received: string[] = [];
    const mapped = Event.map(emitter.event, num => `num:${num}`);
    mapped(val => received.push(val));
    emitter.fire(42);
    expect(received).toEqual(['num:42']);
  });

  it('Event.filter should work', () => {
    const emitter = new Emitter<number>();
    const received: number[] = [];
    const filtered = Event.filter(emitter.event, num => num % 2 === 0);
    filtered(val => received.push(val));
    emitter.fire(1);
    emitter.fire(2);
    emitter.fire(3);
    emitter.fire(4);
    expect(received).toEqual([2, 4]);
  });

  it('Event.debounce should work', async () => {
    const emitter = new Emitter<number>();
    const received: number[] = [];
    const debounced = Event.debounce<number, number>(
      emitter.event,
      (last, val) => (last || 0) + val,
      10
    );
    debounced(val => received.push(val));

    emitter.fire(1);
    emitter.fire(2);
    emitter.fire(3);

    await new Promise(resolve => setTimeout(resolve, 20));
    expect(received).toEqual([6]);
  });

  it('PauseableEmitter should work', () => {
    const emitter = new PauseableEmitter<string>();
    const received: string[] = [];
    emitter.event(val => received.push(val));

    emitter.pause();
    emitter.fire('a');
    emitter.fire('b');
    expect(received).toEqual([]);

    emitter.resume();
    expect(received).toEqual(['a', 'b']);

    emitter.fire('c');
    expect(received).toEqual(['a', 'b', 'c']);
  });

  it('Emitter subscription with DisposableStore should work', () => {
    const emitter = new Emitter<string>();
    const store = new DisposableStore();
    const received: string[] = [];
    emitter.event(val => received.push(val), null, store);
    emitter.fire('a');
    expect(received).toEqual(['a']);
    store.dispose();
    emitter.fire('b');
    expect(received).toEqual(['a']);
  });
});
