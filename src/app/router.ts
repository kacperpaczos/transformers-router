import { ValidationError } from '@domain/errors';

export interface Route {
  path: string;
  handler: (..._args: unknown[]) => unknown;
}

export interface RouterOptions {
  strict?: boolean;
  caseSensitive?: boolean;
}

export class TransformersRouter {
  private routes: Map<string, Route>;
  private options: RouterOptions;

  constructor(options: RouterOptions = {}) {
    this.routes = new Map();
    this.options = {
      strict: options.strict ?? false,
      caseSensitive: options.caseSensitive ?? false,
    };
  }

  /**
   * Register a new route
   * @param path - The route path
   * @param handler - The handler function for this route
   */
  public addRoute(path: string, handler: (..._args: unknown[]) => unknown): void {
    const normalizedPath = this.normalizePath(path);
    this.routes.set(normalizedPath, { path: normalizedPath, handler });
  }

  /**
   * Remove a route
   * @param path - The route path to remove
   */
  public removeRoute(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    return this.routes.delete(normalizedPath);
  }

  /**
   * Get a route by path
   * @param path - The route path
   */
  public getRoute(path: string): Route | undefined {
    const normalizedPath = this.normalizePath(path);
    return this.routes.get(normalizedPath);
  }

  /**
   * Execute a route handler
   * @param path - The route path
   * @param args - Arguments to pass to the handler
   */
  public async execute(path: string, ...args: unknown[]): Promise<unknown> {
    const route = this.getRoute(path);
    if (!route) {
      throw new ValidationError(`Route not found: ${path}`, 'route');
    }
    return route.handler(...args);
  }

  /**
   * Get all registered routes
   */
  public getAllRoutes(): Route[] {
    return Array.from(this.routes.values());
  }

  /**
   * Clear all routes
   */
  public clear(): void {
    this.routes.clear();
  }

  /**
   * Normalize path based on router options
   */
  private normalizePath(path: string): string {
    let normalized = path;

    if (!this.options.caseSensitive) {
      normalized = normalized.toLowerCase();
    }

    if (!this.options.strict) {
      // Remove trailing slashes
      normalized = normalized.replace(/\/+$/, '');
    }

    return normalized || '/';
  }
}
