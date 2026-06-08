/* eslint-disable no-redeclare */
import { describe, it, expect, beforeEach } from 'vitest';
import { createDecorator } from '../instantiation/instantiation';
import { registerSingleton, clearSingletonRegistry, InstantiationType } from '../instantiation/extensions';
import { InstantiationService } from '../instantiation/instantiationService';

describe('Dependency Injection & Instantiation Container', () => {
  beforeEach(() => {
    clearSingletonRegistry();
  });

  it('should inject registered services into constructors', () => {
    const IServiceA = createDecorator<IServiceA>('serviceA');
    interface IServiceA {
      getValue(): string;
    }
    class ServiceA implements IServiceA {
      getValue() { return 'A'; }
    }

    const IServiceB = createDecorator<IServiceB>('serviceB');
    interface IServiceB {
      getCombined(): string;
    }

    class ServiceB implements IServiceB {
      constructor(@IServiceA private readonly serviceA: IServiceA) {}
      getCombined() { return this.serviceA.getValue() + 'B'; }
    }

    const services = new Map<any, any>();
    services.set(IServiceA, new ServiceA());

    const container = new InstantiationService(services);
    const serviceB = container.createInstance(ServiceB);
    expect(serviceB.getCombined()).toBe('AB');
  });

  it('should support eager and delayed singleton registries', () => {
    let serviceAConstructedCount = 0;
    let serviceBConstructedCount = 0;

    const IServiceA = createDecorator<IServiceA>('serviceA');
    interface IServiceA {
      getValue(): string;
    }
    class ServiceA implements IServiceA {
      constructor() {
        serviceAConstructedCount++;
      }
      getValue() { return 'A'; }
    }

    const IServiceB = createDecorator<IServiceB>('serviceB');
    interface IServiceB {
      getValue(): string;
    }
    class ServiceB implements IServiceB {
      constructor() {
        serviceBConstructedCount++;
      }
      getValue() { return 'B'; }
    }

    registerSingleton(IServiceA, ServiceA, InstantiationType.Eager);
    registerSingleton(IServiceB, ServiceB, InstantiationType.Delayed);

    const container = new InstantiationService();

    // Eager service should be constructed immediately
    expect(serviceAConstructedCount).toBe(1);
    expect(serviceBConstructedCount).toBe(0);

    // Delayed service should be wrapped in proxy, not constructed yet
    const accessor = container.invokeFunction(accessor => accessor);
    const serviceBInstance = accessor.get(IServiceB);
    expect(serviceBConstructedCount).toBe(0);

    // Property access should trigger instantiation
    const val = serviceBInstance.getValue();
    expect(val).toBe('B');
    expect(serviceBConstructedCount).toBe(1);
  });

  it('circular dependency detection should throw circular dependency error', () => {
    const IServiceX = createDecorator<IServiceX>('serviceX');
    interface IServiceX {
      getX(): string;
    }

    const IServiceY = createDecorator<IServiceY>('serviceY');
    interface IServiceY {
      getY(): string;
    }

    class ServiceX implements IServiceX {
      constructor(@IServiceY private readonly serviceY: IServiceY) {
        this.serviceY.getY();
      }
      getX() { return 'X'; }
    }

    class ServiceY implements IServiceY {
      constructor(@IServiceX private readonly serviceX: IServiceX) {
        this.serviceX.getX();
      }
      getY() { return 'Y'; }
    }

    // Register them as eager (or delayed but resolved directly)
    registerSingleton(IServiceX, ServiceX, InstantiationType.Eager);
    registerSingleton(IServiceY, ServiceY, InstantiationType.Eager);

    expect(() => {
      new InstantiationService();
    }).toThrow(/Circular dependency detected/);
  });

  it('should support invokeFunction', () => {
    const IServiceA = createDecorator<IServiceA>('serviceA');
    interface IServiceA {
      getValue(): string;
    }
    class ServiceA implements IServiceA {
      getValue() { return 'A'; }
    }

    const services = new Map<any, any>();
    services.set(IServiceA, new ServiceA());

    const container = new InstantiationService(services);
    const result = container.invokeFunction((accessor, prefix: string) => {
      const serviceA = accessor.get(IServiceA);
      return prefix + serviceA.getValue();
    }, 'Value: ');

    expect(result).toBe('Value: A');
  });
});
