// src/lib/logger.ts
// Centralized logger — debug visible only in dev, warn/error always logged.

export const logger = {
  debug: (msg: string, data?: unknown): void => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.debug(`[DEBUG] ${msg}`, data ?? '');
    }
  },
  warn: (msg: string, data?: unknown): void => {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${msg}`, data ?? '');
  },
  error: (msg: string, data?: unknown): void => {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${msg}`, data ?? ''); // Always log errors
    // TODO: Add Sentry.captureException here
  },
};
