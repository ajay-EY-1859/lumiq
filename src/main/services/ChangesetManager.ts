import { getDatabase } from '../db/database';

export interface Changeset {
  id: string;
  name: string;
  files: { filePath: string; patchText: string; accepted: boolean }[];
}

export class ChangesetManager {
  private changesets = new Map<string, Changeset>();

  createChangeset(id: string, name: string): Changeset {
    const cs = { id, name, files: [] };
    this.changesets.set(id, cs);
    return cs;
  }

  addFileChange(changesetId: string, filePath: string, patchText: string): void {
    const cs = this.changesets.get(changesetId);
    if (!cs) throw new Error(`Changeset ${changesetId} not found`);
    const existing = cs.files.find(file => file.filePath === filePath);
    if (existing) {
      existing.patchText = patchText;
      existing.accepted = true;
    } else {
      cs.files.push({ filePath, patchText, accepted: true });
    }
    
    // Optional persistence in database
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO session_edit_decisions (id, session_id, target_file, hunk_header, decision, patch_text)
        VALUES (?, ?, ?, ?, 'accepted', ?)
      `).run(Math.random().toString(36).substring(2, 9), changesetId, filePath, 'hunk', patchText);
    } catch {
      // ignore if database table is locked or session_id does not exist
    }
  }

  toggleFileChange(changesetId: string, filePath: string, accepted: boolean): void {
    const cs = this.changesets.get(changesetId);
    if (!cs) throw new Error(`Changeset ${changesetId} not found`);
    const file = cs.files.find(f => f.filePath === filePath);
    if (file) {
      file.accepted = accepted;
    }
  }

  getChangeset(changesetId: string): Changeset | undefined {
    return this.changesets.get(changesetId);
  }

  generateMergePreview(changesetId: string): string {
    const cs = this.changesets.get(changesetId);
    if (!cs) throw new Error(`Changeset ${changesetId} not found`);

    let diffText = '';
    for (const file of cs.files) {
      if (file.accepted) {
        if (file.patchText.startsWith('diff --git ') || file.patchText.startsWith('--- ')) {
          diffText += file.patchText.endsWith('\n') ? file.patchText : `${file.patchText}\n`;
        } else {
          diffText += `diff --git a/${file.filePath} b/${file.filePath}\n`;
          diffText += `--- a/${file.filePath}\n`;
          diffText += `+++ b/${file.filePath}\n`;
          diffText += `@@ -0,0 +1,${file.patchText.split(/\r?\n/).length} @@\n`;
          for (const line of file.patchText.split(/\r?\n/)) {
            diffText += `+${line}\n`;
          }
        }
      }
    }
    return diffText;
  }
}
