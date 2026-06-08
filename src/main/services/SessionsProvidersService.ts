import { ISessionsProvidersService, ISessionsProvider } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import { Emitter, Event } from '@shared/event';

export class SessionsProvidersService implements ISessionsProvidersService {
  private providers = new Map<string, ISessionsProvider>();

  private readonly _onDidSessionCreate = new Emitter<any>();
  readonly onDidSessionCreate: Event<any> = this._onDidSessionCreate.event;

  constructor() {
    // Register built-in default providers
    this.registerProvider({
      id: 'local-chat',
      name: 'Local Chat Sessions',
      createSession: async (workspacePath) => ({ provider: 'local-chat', workspacePath, createdAt: new Date() })
    });
    this.registerProvider({
      id: 'agent-host-local',
      name: 'Local Agent Host Sessions',
      createSession: async (workspacePath) => ({ provider: 'agent-host-local', workspacePath, createdAt: new Date() })
    });
  }

  registerProvider(provider: ISessionsProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProviders(): ISessionsProvider[] {
    return Array.from(this.providers.values());
  }

  async createSession(providerId: string, workspacePath: string): Promise<any> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Session provider ${providerId} not found`);
    }
    const session = await provider.createSession(workspacePath);
    this._onDidSessionCreate.fire(session);
    return session;
  }
}

registerSingleton(ISessionsProvidersService, SessionsProvidersService, InstantiationType.Delayed);
