import { v4 as uuidv4 } from 'uuid'
import type { InstalledPlugin, PluginManifest, PluginResourceType } from '@shared/types'
import { getDatabase } from './database'

type InstalledPluginRow = {
  id: string
  name: string
  version: string
  category: InstalledPlugin['category']
  author: string
  description: string
  source: InstalledPlugin['source']
  installedAt: string
}

type PluginResourceRow = {
  resourceType: PluginResourceType
  resourceId: string
  name: string
}

function mapInstalled(row: InstalledPluginRow): InstalledPlugin {
  const resources = getDatabase()
    .prepare(
      `SELECT resource_type as resourceType, resource_id as resourceId, name
       FROM plugin_resources
       WHERE plugin_id = ?
       ORDER BY resource_type, name`
    )
    .all(row.id) as PluginResourceRow[]

  return {
    ...row,
    resources: resources.map((resource) => ({
      type: resource.resourceType,
      resourceId: resource.resourceId,
      name: resource.name
    }))
  }
}

export function listInstalledPlugins(): InstalledPlugin[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, name, version, category, author, description, source,
              installed_at as installedAt
       FROM installed_plugins
       ORDER BY name`
    )
    .all() as InstalledPluginRow[]
  return rows.map(mapInstalled)
}

export function getInstalledPlugin(id: string): InstalledPlugin | null {
  const row = getDatabase()
    .prepare(
      `SELECT id, name, version, category, author, description, source,
              installed_at as installedAt
       FROM installed_plugins
       WHERE id = ?`
    )
    .get(id) as InstalledPluginRow | undefined
  return row ? mapInstalled(row) : null
}

export function saveInstalledPlugin(
  manifest: PluginManifest,
  source: InstalledPlugin['source'],
  resources: Array<{ type: PluginResourceType; resourceId: string; name: string }>
): InstalledPlugin {
  const database = getDatabase()
  const insert = database.transaction(() => {
    database
      .prepare(
        `INSERT INTO installed_plugins
           (id, name, version, category, author, description, source, manifest_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        manifest.id,
        manifest.name,
        manifest.version,
        manifest.category,
        manifest.author,
        manifest.description,
        source,
        JSON.stringify(manifest)
      )

    const insertResource = database.prepare(
      `INSERT INTO plugin_resources
         (id, plugin_id, resource_type, resource_id, name)
       VALUES (?, ?, ?, ?, ?)`
    )
    for (const resource of resources) {
      insertResource.run(uuidv4(), manifest.id, resource.type, resource.resourceId, resource.name)
    }
  })

  insert()
  const saved = getInstalledPlugin(manifest.id)
  if (!saved) throw new Error('Failed to save installed plugin')
  return saved
}

export function deleteInstalledPlugin(id: string): boolean {
  return getDatabase().prepare('DELETE FROM installed_plugins WHERE id = ?').run(id).changes > 0
}
