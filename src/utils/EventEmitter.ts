/**
 * Type-safe EventEmitter for handling events in the AI Provider
 */

import type { EventCallback, EventType, EventDataMap } from '../core/types';

export class EventEmitter {
  private events: Map<EventType, Set<EventCallback>>;

  constructor() {
    this.events = new Map();
  }

  /**
   * Register an event listener (type-safe overloads)
   */
  on<T extends EventType>(event: T, callback: EventCallback<T>): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback as EventCallback);
  }

  /**
   * Register a one-time event listener (type-safe overloads)
   */
  once<T extends EventType>(event: T, callback: EventCallback<T>): void {
    const wrappedCallback = ((data: EventDataMap[T]) => {
      callback(data);
      this.off(event, wrappedCallback);
    }) as EventCallback<T>;
    this.on(event, wrappedCallback);
  }

  /**
   * Remove an event listener
   */
  off<T extends EventType>(event: T, callback: EventCallback<T>): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback);
      if (callbacks.size === 0) {
        this.events.delete(event);
      }
    }
  }

  /**
   * Emit an event to all registered listeners (type-safe)
   */
  emit<T extends EventType>(event: T, data: EventDataMap[T]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(event?: EventType): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: EventType): number {
    return this.events.get(event)?.size ?? 0;
  }

  /**
   * Check if there are any listeners for an event
   */
  hasListeners(event: EventType): boolean {
    return this.listenerCount(event) > 0;
  }
}
