/**
 * Creates a trailing-edge debounced version of the provided function.
 * The debounced function delays invoking `fn` until after `delay` milliseconds
 * have elapsed since the last time it was called.
 *
 * @param {Function} fn - The function to debounce
 * @param {number} [delay=300] - Delay in milliseconds (default 300ms)
 * @returns {Function & { cancel: () => void }} Debounced function with a `.cancel()` method
 */
export function debounce(fn, delay = 300) {
  let timerId = null;

  function debounced(...args) {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      timerId = null;
      fn(...args);
    }, delay);
  }

  debounced.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return debounced;
}
