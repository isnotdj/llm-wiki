import fs from 'fs-extra';
import path from 'path';
import { safeWriteFile } from './fileOps.ts';
import type { Config } from '../types/index.ts';

export interface TrackedConceptRef {
  id: string;
  title: string;
}

export interface SourceStateRecord {
  sourceId: string;
  rawPath: string;
  sourcePagePath: string;
  contentHash: string;
  lastRefreshAt: string;
  lastTransactionId: string;
  declaredConcepts: TrackedConceptRef[];
  declaredEntities?: TrackedConceptRef[];
}

export interface ConceptStateRecord {
  conceptId: string;
  title: string;
  conceptPagePath: string;
  sourceIds: string[];
  lastRebuildAt?: string;
}

export interface EntityStateRecord {
  entityId: string;
  title: string;
  entityPagePath: string;
  sourceIds: string[];
  lastRebuildAt?: string;
}

interface SourcesStateFile {
  sources: Record<string, SourceStateRecord>;
}

interface ConceptsStateFile {
  concepts: Record<string, ConceptStateRecord>;
}

interface EntitiesStateFile {
  entities: Record<string, EntityStateRecord>;
}

export class StateStore {
  private config: Config;
  private stateDir: string;
  private sourcesPath: string;
  private conceptsPath: string;
  private entitiesPath: string;

  constructor(config: Config) {
    this.config = config;
    this.stateDir = path.join(config.wikiRoot, '.wiki', 'state');
    this.sourcesPath = path.join(this.stateDir, 'sources.json');
    this.conceptsPath = path.join(this.stateDir, 'concepts.json');
    this.entitiesPath = path.join(this.stateDir, 'entities.json');
  }

  async ensureStateDir(): Promise<void> {
    await fs.ensureDir(this.stateDir);
  }

  async loadSources(): Promise<Record<string, SourceStateRecord>> {
    return this.loadFile<SourcesStateFile>(this.sourcesPath, { sources: {} }).then(data => data.sources);
  }

  async saveSources(sources: Record<string, SourceStateRecord>): Promise<void> {
    await this.ensureStateDir();
    await safeWriteFile(this.sourcesPath, `${JSON.stringify({ sources }, null, 2)}\n`);
  }

  async loadConcepts(): Promise<Record<string, ConceptStateRecord>> {
    return this.loadFile<ConceptsStateFile>(this.conceptsPath, { concepts: {} }).then(data => data.concepts);
  }

  async saveConcepts(concepts: Record<string, ConceptStateRecord>): Promise<void> {
    await this.ensureStateDir();
    await safeWriteFile(this.conceptsPath, `${JSON.stringify({ concepts }, null, 2)}\n`);
  }

  async loadEntities(): Promise<Record<string, EntityStateRecord>> {
    return this.loadFile<EntitiesStateFile>(this.entitiesPath, { entities: {} }).then(data => data.entities);
  }

  async saveEntities(entities: Record<string, EntityStateRecord>): Promise<void> {
    await this.ensureStateDir();
    await safeWriteFile(this.entitiesPath, `${JSON.stringify({ entities }, null, 2)}\n`);
  }

  private async loadFile<T>(filePath: string, fallback: T): Promise<T> {
    if (!(await fs.pathExists(filePath))) {
      return fallback;
    }

    try {
      return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
    } catch (error) {
      throw new Error(`Failed to parse state file ${path.relative(this.config.wikiRoot, filePath)}: ${error}`);
    }
  }
}
