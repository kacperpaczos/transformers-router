import type { Logger } from '@domain/logging/Logger';

export const createDefaultLogger = (debug: boolean): Logger => ({
  debug: (...a: unknown[]) => debug && console.debug('[DEBUG]', ...a),
  info: (...a: unknown[]) => debug && console.info('[INFO]', ...a),
  warn: (...a: unknown[]) => debug && console.warn('[WARN]', ...a),
  error: (...a: unknown[]) => console.error('[ERROR]', ...a),
});


