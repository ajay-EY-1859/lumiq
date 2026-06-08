import { ISkillsService, Skill } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import * as fs from 'fs';
import * as path from 'path';

export class SkillsService implements ISkillsService {
  private parsedSkills: Skill[] = [];

  async discoverSkills(workspacePath: string): Promise<Skill[]> {
    const skills: Skill[] = [];
    
    // Find skill files under the workspace
    const scanDir = (dir: string) => {
      try {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
              scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            if (this.isSkillFile(entry.name)) {
              try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const parsed = this.parseSkillFile(entry.name, content);
                skills.push(parsed);
              } catch (err) {
                console.error(`[SkillsService] Failed to read skill file ${fullPath}:`, err);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[SkillsService] Directory scan error in ${dir}:`, err);
      }
    };

    scanDir(workspacePath);
    this.parsedSkills = skills;
    return skills;
  }

  getSkill(id: string): Skill | undefined {
    return this.parsedSkills.find(s => s.id === id);
  }

  private parseYamlFrontmatter(yamlSection: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = yamlSection.split('\n');
    let currentArrayKey: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '' || line.trim().startsWith('#')) continue;

      const indent = line.search(/\S|$/);
      const trimmed = line.trim();

      // Array item continuation
      if (currentArrayKey && indent > 0 && trimmed.startsWith('-')) {
        const val = trimmed.slice(1).trim().replace(/^['"]|['"]$/g, '');
        if (Array.isArray(result[currentArrayKey])) {
          result[currentArrayKey].push(val);
        }
        continue;
      }
      
      // Reset array context if indent breaks or it's a new key
      if (trimmed.includes(':')) {
        currentArrayKey = null;
        const colonIdx = line.indexOf(':');
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();

        if (value === '') {
          // Start of an array or object (we assume array for tags)
          currentArrayKey = key;
          result[key] = [];
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // Inline array format
          result[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
        } else {
          // Normal scalar value
          result[key] = value.replace(/^['"]|['"]$/g, '');
        }
      }
    }
    return result;
  }

  private parseSkillFile(fileName: string, contentStr: string): Skill {
    let name = fileName;
    let description = 'Custom workspace skill';
    let tags: string[] = [];
    let content = contentStr;

    if (contentStr.startsWith('---')) {
      const parts = contentStr.split('---');
      if (parts.length >= 3) {
        const yamlSection = parts[1];
        content = parts.slice(2).join('---').trim();

        const frontmatter = this.parseYamlFrontmatter(yamlSection);
        
        if (frontmatter.name) name = frontmatter.name;
        if (frontmatter.description) description = frontmatter.description;
        
        if (frontmatter.tags) {
          if (Array.isArray(frontmatter.tags)) {
            tags = frontmatter.tags;
          } else if (typeof frontmatter.tags === 'string') {
            tags = [frontmatter.tags];
          }
        }
      }
    }

    return {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      description,
      content,
      tags
    };
  }

  private isSkillFile(fileName: string): boolean {
    const lower = fileName.toLowerCase();
    return (
      lower.endsWith('.agent.md') ||
      lower.endsWith('.instructions.md') ||
      lower.endsWith('.prompt.md') ||
      lower === 'skill.md'
    );
  }
}

registerSingleton(ISkillsService, SkillsService, InstantiationType.Delayed);
