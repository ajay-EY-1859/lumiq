/* eslint-disable @typescript-eslint/no-namespace, no-redeclare */
import { IDisposable, DisposableStore } from './lifecycle';

export interface Event<T> {
  (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[] | DisposableStore): IDisposable;
}

export namespace Event {
  export const None: Event<any> = () => {
    return { dispose() {} };
  };

  export function map<T, O>(event: Event<T>, mapFn: (e: T) => O): Event<O> {
    return (listener, thisArgs, disposables) => {
      return event(e => listener.call(thisArgs, mapFn(e)), undefined, disposables);
    };
  }

  export function filter<T>(event: Event<T>, filterFn: (e: T) => boolean): Event<T> {
    return (listener, thisArgs, disposables) => {
      return event(e => {
        if (filterFn(e)) {
          listener.call(thisArgs, e);
        }
      }, undefined, disposables);
    };
  }

  export function debounce<T, O>(
    event: Event<T>,
    merge: (last: O | undefined, event: T) => O,
    delay: number
  ): Event<O> {
    return (listener, thisArgs, disposables) => {
      let timer: any;
      let lastVal: O | undefined;
      const sub = event(e => {
        lastVal = merge(lastVal, e);
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          const val = lastVal!;
          lastVal = undefined;
          timer = undefined;
          listener.call(thisArgs, val);
        }, delay);
      });
      const result = {
        dispose() {
          sub.dispose();
          if (timer) {
            clearTimeout(timer);
          }
        }
      };
      if (disposables instanceof DisposableStore) {
        disposables.add(result);
      } else if (Array.isArray(disposables)) {
        disposables.push(result);
      }
      return result;
    };
  }
}

export class Emitter<T> {
  private _event?: Event<T>;
  protected _listeners: Array<{ listener: (e: T) => any; thisArgs?: any }> = [];
  protected _isDisposed = false;

  get event(): Event<T> {
    if (!this._event) {
      this._event = (listener, thisArgs, disposables) => {
        const item = { listener, thisArgs };
        this._listeners.push(item);
        const result = {
          dispose: () => {
            const idx = this._listeners.indexOf(item);
            if (idx !== -1) {
              this._listeners.splice(idx, 1);
            }
          }
        };
        if (disposables instanceof DisposableStore) {
          disposables.add(result);
        } else if (Array.isArray(disposables)) {
          disposables.push(result);
        }
        return result;
      };
    }
    return this._event;
  }

  fire(event: T): void {
    if (this._isDisposed) return;
    const listeners = [...this._listeners];
    for (const item of listeners) {
      try {
        item.listener.call(item.thisArgs, event);
      } catch (err) {
        console.error('Error during event delivery:', err);
      }
    }
  }

  dispose(): void {
    this._isDisposed = true;
    this._listeners = [];
  }
}

export class PauseableEmitter<T> extends Emitter<T> {
  private _isPaused = false;
  private _eventQueue: T[] = [];

  pause(): void {
    this._isPaused = true;
  }

  resume(): void {
    if (!this._isPaused) return;
    this._isPaused = false;
    const queue = this._eventQueue;
    this._eventQueue = [];
    for (const event of queue) {
      this.fire(event);
    }
  }

  override fire(event: T): void {
    if (this._isPaused) {
      this._eventQueue.push(event);
    } else {
      super.fire(event);
    }
  }
}
