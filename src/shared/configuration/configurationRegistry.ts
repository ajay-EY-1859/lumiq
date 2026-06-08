export interface IConfigurationPropertySchema {
  type: 'string' | 'boolean' | 'number' | 'object';
  default: any;
  description?: string;
}

export class ConfigurationRegistry {
  private readonly properties = new Map<string, IConfigurationPropertySchema>();

  registerProperty(key: string, schema: IConfigurationPropertySchema): void {
    this.properties.set(key, schema);
  }

  getProperty(key: string): IConfigurationPropertySchema | undefined {
    return this.properties.get(key);
  }

  getProperties(): Map<string, IConfigurationPropertySchema> {
    return this.properties;
  }

  getDefaults(): Record<string, any> {
    const defaults: Record<string, any> = {};
    for (const [key, schema] of this.properties.entries()) {
      defaults[key] = schema.default;
    }
    return defaults;
  }
}

export const Registry = {
  configuration: new ConfigurationRegistry()
};

// Register default properties for Lumiq settings
Registry.configuration.registerProperty('theme', {
  type: 'string',
  default: 'system',
  description: 'Color theme of the IDE workspace'
});

Registry.configuration.registerProperty('fontSize', {
  type: 'string',
  default: '14',
  description: 'Font size of editor pane and UI text'
});

Registry.configuration.registerProperty('defaultProvider', {
  type: 'string',
  default: 'anthropic',
  description: 'Primary AI model provider name'
});

Registry.configuration.registerProperty('defaultModel', {
  type: 'string',
  default: 'claude-sonnet-4-20250514',
  description: 'Primary AI model identifier'
});

Registry.configuration.registerProperty('sidebarVisible', {
  type: 'boolean',
  default: true,
  description: 'Toggles project explorer sidebar visibility'
});

Registry.configuration.registerProperty('autoSave', {
  type: 'boolean',
  default: true,
  description: 'Enables or disables auto-saving of changes'
});

Registry.configuration.registerProperty('contextLimit', {
  type: 'number',
  default: 150,
  description: 'Maximum chat messages context token buffer window limit (in thousands)'
});

Registry.configuration.registerProperty('firecrawlApiKey', {
  type: 'string',
  default: '',
  description: 'Firecrawl API key for reading and scraping web pages'
});

Registry.configuration.registerProperty('dailyBudgetCap', {
  type: 'number',
  default: 5.00,
  description: 'Maximum daily spending allowance limit for AI providers'
});

Registry.configuration.registerProperty('monthlyBudgetCap', {
  type: 'number',
  default: 50.00,
  description: 'Maximum monthly spending allowance limit for AI providers'
});

Registry.configuration.registerProperty('permissionMode', {
  type: 'string',
  default: 'MANUAL',
  description: 'Agent tool execution permission policy level'
});

Registry.configuration.registerProperty('toolSettings', {
  type: 'object',
  default: [],
  description: 'Fine-grained configuration settings list for MCP tools'
});
