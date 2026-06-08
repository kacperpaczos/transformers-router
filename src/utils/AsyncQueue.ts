/**
 * Simple AsyncQueue for handling streaming events
 */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private resolvers: ((value: T | null) => void)[] = [];
  private _closed = false;
  private _error: Error | null = null;

  enqueue(item: T) {
    if (this._closed) return;
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift();
      resolve!(item);
    } else {
      this.queue.push(item);
    }
  }

  close() {
    this._closed = true;
    // Flush waiting resolvers with null (EOF)
    while (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift();
      resolve!(null);
    }
  }

  error(err: Error) {
    this._error = err;
    this.close();
  }

  async dequeue(): Promise<T | null> {
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }

    if (this._closed) {
      if (this._error) throw this._error;
      return null;
    }

    return new Promise<T | null>(resolve => {
      this.resolvers.push(resolve);
    });
  }
}
