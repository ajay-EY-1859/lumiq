import { ICustomizationHarnessService, CustomizationItem } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';

export class CustomizationHarnessService implements ICustomizationHarnessService {
  private customizations = new Map<string, CustomizationItem[]>();

  constructor() {
    // Register default customizations
    this.setCustomization('local-lumiq', { id: 'instructions', type: 'instruction', content: 'Follow modern clean coding practices.' });
    this.setCustomization('cli-harness', { id: 'pr-prompt', type: 'prompt', content: 'Compile a summary of changes before creating a PR.' });
  }

  getCustomizations(harnessId: string): CustomizationItem[] {
    return this.customizations.get(harnessId) || [];
  }

  setCustomization(harnessId: string, item: CustomizationItem): void {
    this.validateCustomization(item);
    const list = this.customizations.get(harnessId) || [];
    const idx = list.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    this.customizations.set(harnessId, list);
  }

  validateCustomization(item: CustomizationItem): void {
    if (!item || typeof item !== 'object') {
      throw new Error('Validation failed: Customization must be a valid object.');
    }
    if (typeof item.id !== 'string' || item.id.trim() === '') {
      throw new Error('Validation failed: Customization ID is required and must be a string.');
    }
    if (item.type !== 'instruction' && item.type !== 'prompt') {
      throw new Error(`Validation failed: Invalid customization type '${item.type}'. Must be 'instruction' or 'prompt'.`);
    }
    if (typeof item.content !== 'string' || item.content.length < 5) {
      throw new Error(`Validation failed: Content for '${item.id}' is too short (min 5 chars) or invalid.`);
    }
    
    // Security checks for destructive statements or dangerous injections
    const dangerousPatterns = [
      /DROP\s+TABLE/i, 
      /DELETE\s+FROM/i, 
      /TRUNCATE\s+TABLE/i, 
      /rm\s+-rf/i,
      /eval\s*\(/i
    ];
    
    if (item.type === 'instruction') {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(item.content)) {
          throw new Error('Validation failed: Instructions cannot contain destructive database statements.');
        }
      }
    }
  }
}

registerSingleton(ICustomizationHarnessService, CustomizationHarnessService, InstantiationType.Delayed);
