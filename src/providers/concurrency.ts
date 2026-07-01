/**
 * Concurrency limiter — drop-in replacement for `p-limit` (Node-friendly),
 * built on plain Promises with no Node dependencies so it runs on Workers.
 *
 * API mirrors p-limit: `const limit = pLimit(n); limit(() => promise)`.
 */

export function pLimit(concurrency: number): <T>(fn: () => Promise<T>) => Promise<T> {
  if (!Number.isFinite(concurrency) || concurrency < 1) {
    concurrency = 1;
  }

  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = (): void => {
    if (activeCount >= concurrency || queue.length === 0) {
      return;
    }
    activeCount += 1;
    const resolve = queue.shift();
    if (resolve) {
      resolve();
    }
  };

  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = (): void => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            activeCount -= 1;
            next();
          });
      };

      if (activeCount < concurrency) {
        activeCount += 1;
        execute();
      } else {
        queue.push(execute);
      }
    });
  };
}
