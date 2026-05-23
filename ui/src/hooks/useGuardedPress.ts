import { useCallback, useRef } from 'react';

type GuardedPressOptions = {
  /** Minimum time before the same handler can run again. Default 600ms. */
  cooldownMs?: number;
  /** When true, presses are ignored. */
  disabled?: boolean;
};

/**
 * Wraps a press/submit handler so rapid double-taps are ignored until cooldown elapses
 * (or an returned promise settles, whichever is later).
 */
export function useGuardedPress<T extends (...args: never[]) => unknown>(
  fn: T,
  options?: GuardedPressOptions,
): T {
  const { cooldownMs = 600, disabled = false } = options ?? {};
  const busyRef = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback(
    (...args: Parameters<T>) => {
      if (disabled || busyRef.current) return;
      busyRef.current = true;
      const started = Date.now();

      const release = () => {
        const wait = Math.max(0, cooldownMs - (Date.now() - started));
        setTimeout(() => {
          busyRef.current = false;
        }, wait);
      };

      try {
        const result = fnRef.current(...args);
        if (result instanceof Promise) {
          void Promise.resolve(result).finally(release);
        } else {
          release();
        }
      } catch (e) {
        release();
        throw e;
      }
    },
    [disabled, cooldownMs],
  ) as T;
}
