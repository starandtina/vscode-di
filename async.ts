interface IDisposable {
  dispose(): void;
}

export let runWhenIdle: (
  callback: (idle: IdleDeadline) => void,
  timeout?: number
) => IDisposable;

declare function requestIdleCallback(
  callback: (args: IdleDeadline) => void,
  options?: { timeout: number }
): number;
declare function cancelIdleCallback(handle: number): void;

(function () {
  if (
    typeof requestIdleCallback !== 'function' ||
    typeof cancelIdleCallback !== 'function'
  ) {
    runWhenIdle = (runner) => {
      setTimeout(() => {
        if (disposed) {
          return;
        }
        const end = Date.now() + 15; // one frame at 64fps
        runner(
          Object.freeze({
            didTimeout: true,
            timeRemaining() {
              return Math.max(0, end - Date.now());
            },
          })
        );
      });
      let disposed = false;
      return {
        dispose() {
          if (disposed) {
            return;
          }
          disposed = true;
        },
      };
    };
  } else {
    runWhenIdle = (runner, timeout?) => {
      const handle: number = requestIdleCallback(
        runner,
        typeof timeout === 'number' ? { timeout } : undefined
      );
      let disposed = false;
      return {
        dispose() {
          if (disposed) {
            return;
          }
          disposed = true;
          cancelIdleCallback(handle);
        },
      };
    };
  }
})();

/**
 * An implementation of the "idle-until-urgent"-strategy as introduced
 * here: https://philipwalton.com/articles/idle-until-urgent/
 */
export class IdleValue<T> {
  private readonly _executor: () => void;
  private readonly _handle: IDisposable;

  private _didRun: boolean = false;
  private _value?: T;
  private _error: unknown;

  constructor(executor: () => T) {
    this._executor = () => {
      try {
        this._value = executor();
      } catch (err) {
        this._error = err;
      } finally {
        this._didRun = true;
      }
    };
    this._handle = runWhenIdle(() => this._executor());
  }

  dispose(): void {
    this._handle.dispose();
  }

  get value(): T {
    if (!this._didRun) {
      this._handle.dispose();
      this._executor();
    }
    if (this._error) {
      throw this._error;
    }
    return this._value!;
  }

  get isInitialized(): boolean {
    return this._didRun;
  }
}
