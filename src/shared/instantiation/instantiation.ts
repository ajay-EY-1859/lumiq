/* eslint-disable @typescript-eslint/no-unsafe-function-type, no-redeclare */
export interface ServiceIdentifier<T> {
  (...args: any[]): void;
  type: T;
}

export interface ServicesAccessor {
  get<T>(id: ServiceIdentifier<T>): T;
}

export interface IInstantiationService {
  readonly _serviceBrand: undefined;
  createInstance<T>(ctor: { new (...args: any[]): T }, ...args: any[]): T;
  invokeFunction<R, TS extends any[] = []>(fn: (accessor: ServicesAccessor, ...args: TS) => R, ...args: TS): R;
}

const serviceIds = new Map<string, ServiceIdentifier<any>>();
export const DI_DEPENDENCIES = 'di:dependencies';

export function createDecorator<T>(serviceId: string): ServiceIdentifier<T> {
  if (serviceIds.has(serviceId)) {
    return serviceIds.get(serviceId)!;
  }

  const id = function (target: Function, _key: string | undefined, index: number): any {
    if (typeof index !== 'number') {
      throw new Error('@' + serviceId + ' decorator can only be used to decorate a parameter');
    }
    storeServiceDependency(id, target, index);
  } as any;

  id.toString = () => serviceId;

  serviceIds.set(serviceId, id);
  return id;
}

export function storeServiceDependency(id: Function, target: Function, index: number): void {
  const targetCtor = target;
  if (!Object.prototype.hasOwnProperty.call(targetCtor, DI_DEPENDENCIES)) {
    (targetCtor as any)[DI_DEPENDENCIES] = [];
  }
  (targetCtor as any)[DI_DEPENDENCIES].push({ id, index });
}

export function getServiceDependencies(ctor: Function): { id: ServiceIdentifier<any>; index: number }[] {
  // Walk prototype chain if necessary, but typically dependencies are stored directly on the ctor
  let current: any = ctor;
  const result: { id: ServiceIdentifier<any>; index: number }[] = [];
  while (current && current !== Object) {
    if (Object.prototype.hasOwnProperty.call(current, DI_DEPENDENCIES)) {
      result.push(...(current[DI_DEPENDENCIES] || []));
    }
    current = Object.getPrototypeOf(current);
  }
  return result;
}

export const IInstantiationService = createDecorator<IInstantiationService>('instantiationService');
