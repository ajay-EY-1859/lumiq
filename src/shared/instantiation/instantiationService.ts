import { IInstantiationService, ServiceIdentifier, ServicesAccessor, getServiceDependencies } from './instantiation';
import { getSingletonServiceDescriptors } from './extensions';

export class InstantiationService implements IInstantiationService {
  readonly _serviceBrand: undefined;

  private readonly _services: Map<ServiceIdentifier<any>, any>;
  private readonly _actualInstances = new Map<ServiceIdentifier<any>, any>();
  private readonly _activeInstantiations = new Set<any>();

  constructor(services = new Map<ServiceIdentifier<any>, any>()) {
    this._services = services;
    this._services.set(IInstantiationService, this);

    // Instantiate eager singletons immediately
    for (const desc of getSingletonServiceDescriptors()) {
      if (!desc.supportsDelayedInstantiation) {
        this._getOrCreateService(desc.id);
      }
    }
  }

  createInstance<T>(ctor: { new (...args: any[]): T }, ...args: any[]): T {
    const dependencies = getServiceDependencies(ctor);
    const serviceArgs: any[] = [];
    let explicitArgsIndex = 0;

    const maxIndex = dependencies.reduce((max, d) => Math.max(max, d.index), -1);
    const totalArgsCount = Math.max(ctor.length, maxIndex + 1);

    for (let i = 0; i < totalArgsCount; i++) {
      const dep = dependencies.find(d => d.index === i);
      if (dep) {
        serviceArgs[i] = this._getOrCreateService(dep.id);
      } else {
        serviceArgs[i] = args[explicitArgsIndex++];
      }
    }

    while (explicitArgsIndex < args.length) {
      serviceArgs.push(args[explicitArgsIndex++]);
    }

    return new ctor(...serviceArgs);
  }

  invokeFunction<R, TS extends any[] = []>(fn: (accessor: ServicesAccessor, ...args: TS) => R, ...args: TS): R {
    const accessor: ServicesAccessor = {
      get: <T>(id: ServiceIdentifier<T>) => this._getOrCreateService(id)
    };
    return fn(accessor, ...args);
  }

  private _getOrCreateService<T>(id: ServiceIdentifier<T>): T {
    if (this._services.has(id)) {
      return this._services.get(id);
    }

    const descriptors = getSingletonServiceDescriptors();
    const descriptor = descriptors.find(d => d.id === id);
    if (!descriptor) {
      throw new Error(`[DI] Service not found and no singleton descriptor registered: ${id}`);
    }

    if (descriptor.supportsDelayedInstantiation) {
      const proxy = new Proxy({}, {
        get: (_target: any, prop: string | symbol) => {
          if (prop === 'then') {
            return undefined;
          }
          const actualInstance = this._getOrCreateActualServiceInstance(id, descriptor.ctor);
          const val = (actualInstance as any)[prop];
          if (typeof val === 'function') {
            return val.bind(actualInstance);
          }
          return val;
        },
        set: (_target: any, prop: string | symbol, value: any) => {
          const actualInstance = this._getOrCreateActualServiceInstance(id, descriptor.ctor);
          (actualInstance as any)[prop] = value;
          return true;
        }
      });
      this._services.set(id, proxy);
      return proxy as any;
    }

    return this._getOrCreateActualServiceInstance(id, descriptor.ctor);
  }

  private _getOrCreateActualServiceInstance<T>(id: ServiceIdentifier<T>, ctor: { new (...args: any[]): T }): T {
    if (this._actualInstances.has(id)) {
      return this._actualInstances.get(id);
    }

    if (this._activeInstantiations.has(id)) {
      throw new Error(`[DI] Circular dependency detected for service: ${id}`);
    }

    this._activeInstantiations.add(id);
    try {
      const instance = this.createInstance(ctor);
      this._actualInstances.set(id, instance);
      this._services.set(id, instance);
      return instance;
    } finally {
      this._activeInstantiations.delete(id);
    }
  }
}

let activeContainer: IInstantiationService | undefined;

export function getActiveContainer(): IInstantiationService {
  if (!activeContainer) {
    throw new Error('No active DI container set.');
  }
  return activeContainer;
}

export function setActiveContainer(container: IInstantiationService): void {
  activeContainer = container;
}

export function getService<T>(id: ServiceIdentifier<T>): T {
  if (!activeContainer) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[DI] Accessing service ${id} before active container is set.`);
    }
    return new Proxy({}, {
      get: (_target, prop) => {
        if (prop === 'then') return undefined;
        return () => {};
      }
    }) as any;
  }
  return activeContainer.invokeFunction(accessor => accessor.get(id));
}
