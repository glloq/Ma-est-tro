// tests/frontend/event-bus.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Load the frontend EventBus via script execution in jsdom
import { readFileSync } from 'fs';
import { resolve } from 'path';

const eventBusSource = readFileSync(resolve(__dirname, '../../public/js/core/EventBus.js'), 'utf8');

describe('Frontend EventBus', () => {
  let bus;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Execute the EventBus source in jsdom context
    const fn = new Function(eventBusSource);
    fn();

    bus = new window.EventBus();
  });

  afterEach(() => {
    if (bus) bus.destroy();
    vi.restoreAllMocks();
  });

  describe('on / emit', () => {
    it('calls listener on emit with HIGH priority (sync)', () => {
      const handler = vi.fn();
      bus.on('test', handler);
      bus.emit('test', { value: 1 }, window.EventPriority.HIGH);

      expect(handler).toHaveBeenCalledWith({ value: 1 });
    });

    it('calls listener on emit with NORMAL priority (async via microtask)', async () => {
      const handler = vi.fn();
      bus.on('test', handler);
      bus.emit('test', { value: 2 });

      // NORMAL priority uses microtask queue
      await new Promise((r) => setTimeout(r, 0));
      expect(handler).toHaveBeenCalledWith({ value: 2 });
    });

    it('supports multiple listeners', async () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('test', h1);
      bus.on('test', h2);
      bus.emit('test', 'data', window.EventPriority.HIGH);

      expect(h1).toHaveBeenCalled();
      expect(h2).toHaveBeenCalled();
    });
  });

  describe('off', () => {
    it('removes a specific listener', () => {
      const handler = vi.fn();
      bus.on('test', handler);
      bus.off('test', handler);
      bus.emit('test', {}, window.EventPriority.HIGH);

      expect(handler).not.toHaveBeenCalled();
    });

    it('removes all listeners for event when no callback provided', () => {
      bus.on('test', vi.fn());
      bus.on('test', vi.fn());
      bus.off('test');

      expect(bus.getListenerCount('test')).toBe(0);
    });
  });

  describe('once', () => {
    it('fires listener only once', () => {
      const handler = vi.fn();
      bus.once('test', handler);
      bus.emit('test', 'a', window.EventPriority.HIGH);
      bus.emit('test', 'b', window.EventPriority.HIGH);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe function', () => {
    it('on() returns an unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = bus.on('test', handler);
      unsub();
      bus.emit('test', {}, window.EventPriority.HIGH);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('metrics', () => {
    it('tracks emitted event count', () => {
      bus.emit('a', {}, window.EventPriority.HIGH);
      bus.emit('b', {}, window.EventPriority.HIGH);

      const metrics = bus.getMetrics();
      expect(metrics.eventsEmitted).toBe(2);
    });
  });

  describe('clear / destroy', () => {
    it('clear removes all listeners', () => {
      bus.on('a', vi.fn());
      bus.on('b', vi.fn());
      bus.clear();

      expect(bus.getListenerCount()).toBe(0);
    });
  });

  describe('filter option', () => {
    it('only calls listener when filter returns true', () => {
      const handler = vi.fn();
      bus.on('test', handler, { filter: (data) => data.type === 'go' });
      bus.emit('test', { type: 'no' }, window.EventPriority.HIGH);
      bus.emit('test', { type: 'go' }, window.EventPriority.HIGH);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ type: 'go' });
    });
  });
});
