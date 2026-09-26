import {carloError, type CarloErrorCode} from '../errors.js';

export async function withDeadline<T>(
  work: Promise<T>, timeoutMs: number, code: CarloErrorCode, operation: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(carloError(code, operation, `${operation} exceeded its ${timeoutMs}ms deadline`)), timeoutMs);
    timer.unref();
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
