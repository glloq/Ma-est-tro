import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import EventBus from '../src/core/EventBus.js';

describe('EventBus', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe('on / emit', () => {
    test('calls listener when event is emitted', () => {
      const handler = jest.fn();
      bus.on('test', handler);
      bus.emit('test', { value: 1 });

      expect(handler).toHaveBeenCalledWith({ value: 1 });
    });

    test('supports multiple listeners for same event', () => {
      const h1 = jest.fn();
      const h2 = jest.fn();
      bus.on('test', h1);
      bus.on('test', h2);
      bus.emit('test', 'data');

      expect(h1).toHaveBeenCalledWith('data');
      expect(h2).toHaveBeenCalledWith('data');
    });

    test('does not call listeners for different events', () => {
      const handler = jest.fn();
      bus.on('a', handler);
      bus.emit('b', 'data');

      expect(handler).not.toHaveBeenCalled();
    });

    test('emitting unknown event does not throw', () => {
      expect(() => bus.emit('nonexistent', {})).not.toThrow();
    });
  });

  describe('off', () => {
    test('removes a specific listener', () => {
      const handler = jest.fn();
      bus.on('test', handler);
      bus.off('test', handler);
      bus.emit('test');

      expect(handler).not.toHaveBeenCalled();
    });

    test('does not throw when removing from nonexistent event', () => {
      expect(() => bus.off('nope', () => {})).not.toThrow();
    });

    test('cleans up empty event entries', () => {
      const handler = jest.fn();
      bus.on('test', handler);
      bus.off('test', handler);

      expect(bus.listenerCount('test')).toBe(0);
    });
  });

  describe('once', () => {
    test('listener fires only once', () => {
      const handler = jest.fn();
      bus.once('test', handler);

      bus.emit('test', 'first');
      bus.emit('test', 'second');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('first');
    });
  });

  describe('error handling', () => {
    test('catching errors in listeners does not break other listeners', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const badHandler = () => {
        throw new Error('boom');
      };
      const goodHandler = jest.fn();

      bus.on('test', badHandler);
      bus.on('test', goodHandler);
      bus.emit('test', 'data');

      expect(goodHandler).toHaveBeenCalledWith('data');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('removeAllListeners', () => {
    test('removes all listeners for a specific event', () => {
      bus.on('a', jest.fn());
      bus.on('b', jest.fn());
      bus.removeAllListeners('a');

      expect(bus.listenerCount('a')).toBe(0);
      expect(bus.listenerCount('b')).toBe(1);
    });

    test('removes all listeners when no event specified', () => {
      bus.on('a', jest.fn());
      bus.on('b', jest.fn());
      bus.removeAllListeners();

      expect(bus.eventNames()).toEqual([]);
    });
  });

  describe('listenerCount / eventNames', () => {
    test('returns correct count', () => {
      bus.on('test', jest.fn());
      bus.on('test', jest.fn());
      expect(bus.listenerCount('test')).toBe(2);
    });

    test('returns 0 for unknown event', () => {
      expect(bus.listenerCount('nope')).toBe(0);
    });

    test('returns all event names', () => {
      bus.on('a', jest.fn());
      bus.on('b', jest.fn());
      expect(bus.eventNames().sort()).toEqual(['a', 'b']);
    });
  });
});
