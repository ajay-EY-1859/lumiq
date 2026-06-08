import { ServiceIdentifier } from './instantiation';

export enum InstantiationType {
  Eager = 1,
  Delayed = 2
}

export interface ISingletonServiceDescriptor<T> {
  id: ServiceIdentifier<T>;
  ctor: { new (...args: any[]): T };
  supportsDelayedInstantiation: boolean;
}

const _registry: ISingletonServiceDescriptor<any>[] = [];

export function registerSingleton<T>(
  id: ServiceIdentifier<T>,
  ctor: { new (...args: any[]): T },
  instantiationType: InstantiationType = InstantiationType.Delayed
): void {
  _registry.push({
    id,
    ctor,
    supportsDelayedInstantiation: instantiationType === InstantiationType.Delayed
  });
}

export function getSingletonServiceDescriptors(): ISingletonServiceDescriptor<any>[] {
  return _registry;
}

export function clearSingletonRegistry(): void {
  _registry.length = 0;
}
