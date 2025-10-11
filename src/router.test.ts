import { TransformersRouter } from './router';

describe('TransformersRouter', () => {
  let router: TransformersRouter;

  beforeEach(() => {
    router = new TransformersRouter();
  });

  describe('addRoute', () => {
    it('should add a route', () => {
      const handler = jest.fn();
      router.addRoute('/test', handler);
      
      const route = router.getRoute('/test');
      expect(route).toBeDefined();
      expect(route?.path).toBe('/test');
      expect(route?.handler).toBe(handler);
    });

    it('should normalize paths by default', () => {
      const handler = jest.fn();
      router.addRoute('/Test/', handler);
      
      const route = router.getRoute('/test');
      expect(route).toBeDefined();
    });
  });

  describe('removeRoute', () => {
    it('should remove an existing route', () => {
      const handler = jest.fn();
      router.addRoute('/test', handler);
      
      const removed = router.removeRoute('/test');
      expect(removed).toBe(true);
      expect(router.getRoute('/test')).toBeUndefined();
    });

    it('should return false when removing non-existent route', () => {
      const removed = router.removeRoute('/nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('getRoute', () => {
    it('should get an existing route', () => {
      const handler = jest.fn();
      router.addRoute('/test', handler);
      
      const route = router.getRoute('/test');
      expect(route).toBeDefined();
      expect(route?.handler).toBe(handler);
    });

    it('should return undefined for non-existent route', () => {
      const route = router.getRoute('/nonexistent');
      expect(route).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('should execute a route handler', async () => {
      const handler = jest.fn().mockReturnValue('result');
      router.addRoute('/test', handler);
      
      const result = await router.execute('/test');
      expect(handler).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should pass arguments to handler', async () => {
      const handler = jest.fn().mockReturnValue('result');
      router.addRoute('/test', handler);
      
      await router.execute('/test', 'arg1', 'arg2');
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should throw error for non-existent route', async () => {
      await expect(router.execute('/nonexistent')).rejects.toThrow('Route not found: /nonexistent');
    });

    it('should handle async handlers', async () => {
      const handler = jest.fn().mockResolvedValue('async result');
      router.addRoute('/test', handler);
      
      const result = await router.execute('/test');
      expect(result).toBe('async result');
    });
  });

  describe('getAllRoutes', () => {
    it('should return all routes', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      router.addRoute('/test1', handler1);
      router.addRoute('/test2', handler2);
      
      const routes = router.getAllRoutes();
      expect(routes).toHaveLength(2);
      expect(routes.map(r => r.path)).toEqual(expect.arrayContaining(['/test1', '/test2']));
    });

    it('should return empty array when no routes', () => {
      const routes = router.getAllRoutes();
      expect(routes).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all routes', () => {
      router.addRoute('/test1', jest.fn());
      router.addRoute('/test2', jest.fn());
      
      router.clear();
      
      expect(router.getAllRoutes()).toHaveLength(0);
    });
  });

  describe('RouterOptions', () => {
    describe('caseSensitive', () => {
      it('should match case-insensitively by default', () => {
        const handler = jest.fn();
        router.addRoute('/Test', handler);
        
        const route = router.getRoute('/test');
        expect(route).toBeDefined();
      });

      it('should match case-sensitively when enabled', () => {
        const caseSensitiveRouter = new TransformersRouter({ caseSensitive: true });
        const handler = jest.fn();
        
        caseSensitiveRouter.addRoute('/Test', handler);
        
        expect(caseSensitiveRouter.getRoute('/Test')).toBeDefined();
        expect(caseSensitiveRouter.getRoute('/test')).toBeUndefined();
      });
    });

    describe('strict', () => {
      it('should ignore trailing slashes by default', () => {
        const handler = jest.fn();
        router.addRoute('/test/', handler);
        
        const route = router.getRoute('/test');
        expect(route).toBeDefined();
      });

      it('should match trailing slashes strictly when enabled', () => {
        const strictRouter = new TransformersRouter({ strict: true });
        const handler = jest.fn();
        
        strictRouter.addRoute('/test/', handler);
        
        expect(strictRouter.getRoute('/test/')).toBeDefined();
        expect(strictRouter.getRoute('/test')).toBeUndefined();
      });
    });
  });
});
