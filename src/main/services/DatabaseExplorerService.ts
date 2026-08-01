import { IDatabaseExplorerService, DBTableInfo, DBColumnInfo } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import { getDatabase } from '../db/database';

export class DatabaseExplorerService implements IDatabaseExplorerService {
  async getTables(): Promise<DBTableInfo[]> {
    const db = getDatabase();
    const rows = db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'").all() as any[];
    return rows.map(r => ({ name: r.name, type: r.type }));
  }

  async getTableSchema(tableName: string): Promise<DBColumnInfo[]> {
    const db = getDatabase();
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    return rows.map(r => ({
      name: r.name,
      type: r.type,
      notnull: r.notnull === 1,
      dflt_value: r.dflt_value,
      pk: r.pk === 1
    }));
  }

  async executeQuery(sql: string): Promise<any[]> {
    const db = getDatabase();
    const stmt = db.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('PRAGMA')) {
      return stmt.all();
    } else {
      const info = stmt.run();
      return [info];
    }
  }

  async generateSchemaDeclaration(format: 'prisma' | 'drizzle'): Promise<string> {
    const tables = await this.getTables();
    let schema = '';

    if (format === 'prisma') {
      schema += `datasource db {\n  provider = "sqlite"\n  url      = "file:./lumiq.db"\n}\n\n`;
      for (const table of tables) {
        if (table.type !== 'table') continue;
        schema += `model ${this.capitalize(table.name)} {\n`;
        const columns = await this.getTableSchema(table.name);
        for (const col of columns) {
          const typeMap: Record<string, string> = {
            'INTEGER': 'Int',
            'TEXT': 'String',
            'BLOB': 'Bytes',
            'REAL': 'Float',
            'BOOLEAN': 'Boolean'
          };
          const prismaType = typeMap[col.type.toUpperCase()] || 'String';
          const pkAttr = col.pk ? ' @id' : '';
          const nullable = !col.notnull && !col.pk ? '?' : '';
          schema += `  ${col.name} ${prismaType}${nullable}${pkAttr}\n`;
        }
        schema += `}\n\n`;
      }
    } else {
      schema += `import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';\n\n`;
      for (const table of tables) {
        if (table.type !== 'table') continue;
        schema += `export const ${table.name} = sqliteTable('${table.name}', {\n`;
        const columns = await this.getTableSchema(table.name);
        for (const col of columns) {
          if (col.type.toUpperCase() === 'INTEGER') {
            schema += `  ${col.name}: integer('${col.name}')${col.pk ? '.primaryKey()' : ''},\n`;
          } else {
            schema += `  ${col.name}: text('${col.name}')${col.pk ? '.primaryKey()' : ''},\n`;
          }
        }
        schema += `});\n\n`;
      }
    }

    return schema.trim();
  }

  async generateMockData(tableName: string, count: number): Promise<any[]> {
    const columns = await this.getTableSchema(tableName);
    const mockDataList: any[] = [];
    const db = getDatabase();

    for (let i = 0; i < count; i++) {
      const mockRow: Record<string, any> = {};
      const colNames: string[] = [];
      const placeholders: string[] = [];
      const values: any[] = [];

      for (const col of columns) {
        let val: any;
        if (col.pk && col.type.toUpperCase() === 'INTEGER') {
          continue;
        }

        if (col.type.toUpperCase() === 'INTEGER') {
          val = Math.floor(Math.random() * 1000);
        } else if (col.type.toUpperCase() === 'REAL') {
          val = parseFloat((Math.random() * 100).toFixed(2));
        } else if (col.type.toUpperCase() === 'BOOLEAN') {
          val = Math.random() > 0.5 ? 1 : 0;
        } else {
          val = `${col.name}_mock_${Math.random().toString(36).substring(2, 7)}`;
        }

        mockRow[col.name] = val;
        colNames.push(col.name);
        placeholders.push('?');
        values.push(val);
      }

      if (colNames.length > 0) {
        db.prepare(`
          INSERT INTO ${tableName} (${colNames.join(', ')})
          VALUES (${placeholders.join(', ')})
        `).run(...values);
        mockDataList.push(mockRow);
      }
    }

    return mockDataList;
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

registerSingleton(IDatabaseExplorerService, DatabaseExplorerService, InstantiationType.Delayed);
