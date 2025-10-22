import type { Logger } from '@domain/logging/Logger';

export interface InitOptions {
  debug?: boolean;
  models?: string[];
  logger?: Logger;
}

export interface RuntimeConfig {
  debug: boolean;
  logger: Logger;
}
