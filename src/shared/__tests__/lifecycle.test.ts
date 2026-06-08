import { describe, it, expect, vi } from 'vitest';
import { DisposableStore, DisposableMap, MutableDisposable, RefCountedDisposable, Disposable, toDisposable, setDisposableTracker } from '../lifecycle';

describe('Disposable Lifecycle', () => {
  it('toDisposable should work', () => {
    let called = 0;
    const disp = toDisposable(() => called++);
    disp.dispose();
    disp.dispose();
    expect(called).toBe(1);
  });

  it('DisposableStore should collect and dispose', () => {
    const store = new DisposableStore();
    let called1 = 0;
    let called2 = 0;
    store.add(toDisposable(() => called1++));
    store.add(toDisposable(() => called2++));
    store.dispose();
    expect(called1).toBe(1);
    expect(called2).toBe(1);
  });

  it('DisposableStore should warn and dispose on add if already disposed', () => {
    const store = new DisposableStore();
    store.dispose();
    let called = 0;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.add(toDisposable(() => called++));
    expect(called).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('DisposableMap should work', () => {
    const map = new DisposableMap<string>();
    let called1 = 0;
    let called2 = 0;
    map.set('a', toDisposable(() => called1++));
    map.set('a', toDisposable(() => called2++)); // overwrites 'a' and disposes called1
    expect(called1).toBe(1);
    expect(called2).toBe(0);
    map.dispose();
    expect(called2).toBe(1);
  });

  it('MutableDisposable should work', () => {
    const mutable = new MutableDisposable();
    let called1 = 0;
    let called2 = 0;
    mutable.value = toDisposable(() => called1++);
    mutable.value = toDisposable(() => called2++);
    expect(called1).toBe(1);
    expect(called2).toBe(0);
    mutable.dispose();
    expect(called2).toBe(1);
  });

  it('RefCountedDisposable should work', () => {
    let called = 0;
    const inner = toDisposable(() => called++);
    const ref = new RefCountedDisposable(inner);
    const ref2 = ref.acquire();
    ref.dispose();
    expect(called).toBe(0);
    ref2.dispose();
    expect(called).toBe(1);
  });

  it('Disposable tracker should track', () => {
    const trackDisposable = vi.fn();
    const trackDisposed = vi.fn();
    setDisposableTracker({ trackDisposable, trackDisposed });

    class TestDisposable extends Disposable {}
    const t = new TestDisposable();
    expect(trackDisposable).toHaveBeenCalledWith(t);

    t.dispose();
    expect(trackDisposed).toHaveBeenCalledWith(t);
    setDisposableTracker(undefined);
  });
});
