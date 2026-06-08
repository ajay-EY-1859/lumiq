export interface IDisposable {
  dispose(): void;
}

export class CombinedDisposableError extends Error {
  constructor(public readonly errors: any[]) {
    super(`Errors occurred during disposal: ${errors.map(e => e?.message || String(e)).join(', ')}`);
    this.name = 'CombinedDisposableError';
  }
}

export function toDisposable(fn: () => void): IDisposable {
  let disposed = false;
  return {
    dispose() {
      if (!disposed) {
        disposed = true;
        fn();
      }
    }
  };
}

export interface IDisposableTracker {
  trackDisposable(t: IDisposable): void;
  trackDisposed(t: IDisposable): void;
}

let disposableTracker: IDisposableTracker | undefined;

export function setDisposableTracker(tracker: IDisposableTracker | undefined): void {
  disposableTracker = tracker;
}

export function getDisposableTracker(): IDisposableTracker | undefined {
  return disposableTracker;
}

export class DisposableStore implements IDisposable {
  private readonly _toDispose = new Set<IDisposable>();
  private _isDisposed = false;

  add<T extends IDisposable>(t: T): T {
    if (!t) return t;
    if (this._isDisposed) {
      console.warn('Adding to a disposed DisposableStore');
      t.dispose();
    } else {
      this._toDispose.add(t);
    }
    return t;
  }

  clear(): void {
    if (this._toDispose.size === 0) return;
    const errors: any[] = [];
    for (const item of this._toDispose) {
      try {
        item.dispose();
      } catch (e) {
        errors.push(e);
      }
    }
    this._toDispose.clear();
    if (errors.length > 0) {
      throw new CombinedDisposableError(errors);
    }
  }

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    this.clear();
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }
}

export class DisposableMap<K, V extends IDisposable = IDisposable> implements IDisposable {
  private readonly _store = new Map<K, V>();
  private _isDisposed = false;

  set(key: K, value: V): void {
    if (this._isDisposed) {
      value.dispose();
      return;
    }
    const old = this._store.get(key);
    if (old) {
      old.dispose();
    }
    this._store.set(key, value);
  }

  get(key: K): V | undefined {
    return this._store.get(key);
  }

  has(key: K): boolean {
    return this._store.has(key);
  }

  delete(key: K): boolean {
    const old = this._store.get(key);
    if (old) {
      old.dispose();
      return this._store.delete(key);
    }
    return false;
  }

  clear(): void {
    for (const val of this._store.values()) {
      val.dispose();
    }
    this._store.clear();
  }

  dispose(): void {
    this._isDisposed = true;
    this.clear();
  }
}

export class MutableDisposable<T extends IDisposable = IDisposable> implements IDisposable {
  private _value?: T;
  private _isDisposed = false;

  get value(): T | undefined {
    return this._value;
  }

  set value(newValue: T | undefined) {
    if (this._isDisposed) {
      newValue?.dispose();
      return;
    }
    this._value?.dispose();
    this._value = newValue;
  }

  clear(): void {
    this.value = undefined;
  }

  dispose(): void {
    this._isDisposed = true;
    this._value?.dispose();
    this._value = undefined;
  }
}

export class RefCountedDisposable implements IDisposable {
  private _refCount = 1;

  constructor(private readonly _disposable: IDisposable) {}

  acquire(): this {
    this._refCount++;
    return this;
  }

  dispose(): void {
    if (--this._refCount === 0) {
      this._disposable.dispose();
    }
  }
}

export abstract class Disposable implements IDisposable {
  static readonly None = Object.freeze<IDisposable>({ dispose() {} });

  protected readonly _store = new DisposableStore();

  constructor() {
    if (disposableTracker) {
      disposableTracker.trackDisposable(this);
    }
  }

  protected _register<T extends IDisposable>(t: T): T {
    return this._store.add(t);
  }

  dispose(): void {
    if (disposableTracker) {
      disposableTracker.trackDisposed(this);
    }
    this._store.dispose();
  }
}
