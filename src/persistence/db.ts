import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project, Script, StoredFile, StoredPlot, WorkspaceSnapshot, ExecutionRecord } from '@/types';

interface RPadDB extends DBSchema {
  projects: { key: string; value: Project; indexes: { byUpdated: number } };
  scripts: { key: string; value: Script; indexes: { byProject: string } };
  files: { key: string; value: StoredFile; indexes: { byProject: string } };
  plots: { key: string; value: StoredPlot; indexes: { byProject: string } };
  snapshots: { key: string; value: WorkspaceSnapshot; indexes: { byProject: string } };
  executions: { key: string; value: ExecutionRecord; indexes: { byProject: string } };
  settings: { key: string; value: { key: string; value: unknown } };
}

export const DB_NAME = 'rpad';
export const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RPadDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<RPadDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RPadDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const projects = db.createObjectStore('projects', { keyPath: 'id' });
        projects.createIndex('byUpdated', 'updatedAt');
        db.createObjectStore('scripts', { keyPath: 'id' }).createIndex('byProject', 'projectId');
        db.createObjectStore('files', { keyPath: 'key' }).createIndex('byProject', 'projectId');
        db.createObjectStore('plots', { keyPath: 'id' }).createIndex('byProject', 'projectId');
        db.createObjectStore('snapshots', { keyPath: 'id' }).createIndex('byProject', 'projectId');
        db.createObjectStore('executions', { keyPath: 'id' }).createIndex('byProject', 'projectId');
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

export function newId(prefix = ''): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${rnd}` : rnd;
}

/** Limits that keep IndexedDB usage predictable on tablets. */
export const LIMITS = {
  maxPlotsPerProject: 60,
  maxExecutionsPerProject: 300,
  maxSnapshotsPerProject: 5,
  maxFileBytes: 50 * 1024 * 1024,
};

export const repo = {
  async listProjects(): Promise<Project[]> {
    const db = await getDb();
    const all = await db.getAll('projects');
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async getProject(id: string) {
    return (await getDb()).get('projects', id);
  },
  async putProject(p: Project) {
    await (await getDb()).put('projects', p);
  },
  async deleteProject(id: string) {
    const db = await getDb();
    const tx = db.transaction(['projects', 'scripts', 'files', 'plots', 'snapshots', 'executions'], 'readwrite');
    await tx.objectStore('projects').delete(id);
    for (const store of ['scripts', 'files', 'plots', 'snapshots', 'executions'] as const) {
      const keys = await tx.objectStore(store).index('byProject').getAllKeys(id);
      for (const k of keys) await tx.objectStore(store).delete(k);
    }
    await tx.done;
  },

  async listScripts(projectId: string): Promise<Script[]> {
    const db = await getDb();
    const all = await db.getAllFromIndex('scripts', 'byProject', projectId);
    return all.sort((a, b) => a.order - b.order);
  },
  async putScript(s: Script) {
    await (await getDb()).put('scripts', s);
  },
  async deleteScript(id: string) {
    await (await getDb()).delete('scripts', id);
  },

  async listFiles(projectId: string): Promise<StoredFile[]> {
    return (await getDb()).getAllFromIndex('files', 'byProject', projectId);
  },
  async getFile(projectId: string, name: string) {
    return (await getDb()).get('files', `${projectId}:${name}`);
  },
  async putFile(f: StoredFile) {
    await (await getDb()).put('files', f);
  },
  async deleteFile(projectId: string, name: string) {
    await (await getDb()).delete('files', `${projectId}:${name}`);
  },

  async listPlots(projectId: string): Promise<StoredPlot[]> {
    const all = await (await getDb()).getAllFromIndex('plots', 'byProject', projectId);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },
  async putPlot(p: StoredPlot) {
    const db = await getDb();
    await db.put('plots', p);
    const all = await db.getAllFromIndex('plots', 'byProject', p.projectId);
    if (all.length > LIMITS.maxPlotsPerProject) {
      all.sort((a, b) => a.createdAt - b.createdAt);
      for (const old of all.slice(0, all.length - LIMITS.maxPlotsPerProject)) await db.delete('plots', old.id);
    }
  },
  async deletePlot(id: string) {
    await (await getDb()).delete('plots', id);
  },
  async clearPlots(projectId: string) {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex('plots', 'byProject', projectId);
    for (const k of keys) await db.delete('plots', k);
  },

  async listSnapshots(projectId: string): Promise<WorkspaceSnapshot[]> {
    const all = await (await getDb()).getAllFromIndex('snapshots', 'byProject', projectId);
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },
  async putSnapshot(s: WorkspaceSnapshot) {
    const db = await getDb();
    await db.put('snapshots', s);
    const all = await db.getAllFromIndex('snapshots', 'byProject', s.projectId);
    if (all.length > LIMITS.maxSnapshotsPerProject) {
      all.sort((a, b) => b.createdAt - a.createdAt);
      for (const old of all.slice(LIMITS.maxSnapshotsPerProject)) await db.delete('snapshots', old.id);
    }
  },
  async deleteSnapshot(id: string) {
    await (await getDb()).delete('snapshots', id);
  },

  async listExecutions(projectId: string): Promise<ExecutionRecord[]> {
    const all = await (await getDb()).getAllFromIndex('executions', 'byProject', projectId);
    return all.sort((a, b) => a.startedAt - b.startedAt);
  },
  async putExecution(e: ExecutionRecord) {
    await (await getDb()).put('executions', e);
  },
  async trimExecutions(projectId: string) {
    const db = await getDb();
    const all = await db.getAllFromIndex('executions', 'byProject', projectId);
    if (all.length > LIMITS.maxExecutionsPerProject) {
      all.sort((a, b) => a.startedAt - b.startedAt);
      for (const old of all.slice(0, all.length - LIMITS.maxExecutionsPerProject)) await db.delete('executions', old.id);
    }
  },
  async clearExecutions(projectId: string) {
    const db = await getDb();
    const keys = await db.getAllKeysFromIndex('executions', 'byProject', projectId);
    for (const k of keys) await db.delete('executions', k);
  },

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const row = await (await getDb()).get('settings', key);
    return row ? (row.value as T) : fallback;
  },
  async setSetting(key: string, value: unknown) {
    await (await getDb()).put('settings', { key, value });
  },

  async estimateUsage(): Promise<{ usage: number; quota: number } | null> {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
    }
    return null;
  },
};
