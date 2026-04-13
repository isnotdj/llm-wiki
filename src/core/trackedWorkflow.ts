import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { LLMClient } from './llmClient.ts';
import { PromptBuilder } from './promptBuilder.ts';
import { StateStore, type ConceptStateRecord, type SourceStateRecord, type TrackedConceptRef } from './stateStore.ts';
import { parseJsonResponse } from './jsonUtils.ts';
import { safeWriteFile } from './fileOps.ts';
import type { Config } from '../types/index.ts';

export interface WorkflowOptions {
  debug?: boolean;
  dryRun?: boolean;
}

interface SourceRefreshPlan {
  sourceContent: string;
  concepts: Array<{ id: string; title: string }>;
  logMessage?: string;
}

interface ConceptRebuildPlan {
  content: string;
  logMessage?: string;
}

export interface RebuildConceptResult {
  conceptId: string;
  title: string;
  conceptPagePath: string;
  sourceIds: string[];
  changed: boolean;
}

export interface RefreshSourceResult {
  sourceId: string;
  rawPath: string;
  sourcePagePath: string;
  changed: boolean;
  affectedConceptIds: string[];
  rebuiltConcepts: RebuildConceptResult[];
}

export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function makeTransactionId(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function collectMarkdownFiles(dir: string, base = ''): Promise<string[]> {
  const results: string[] = [];
  if (!(await fs.pathExists(dir))) return results;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...await collectMarkdownFiles(path.join(dir, entry.name), relPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(relPath);
    }
  }

  return results;
}

export function sanitizeConceptId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[/\\|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function deriveSourcePagePath(rawTrackedRelativePath: string): string {
  return path.posix.join('wiki', 'sources', rawTrackedRelativePath);
}

export function deriveConceptPagePath(conceptId: string): string {
  return path.posix.join('wiki', 'concepts', `${conceptId}.md`);
}

export async function refreshTrackedSource(
  config: Config,
  sourceRelativePath: string,
  options: WorkflowOptions & { cascade?: boolean; yes?: boolean } = {}
): Promise<RefreshSourceResult> {
  const stateStore = new StateStore(config);
  const llm = new LLMClient(config);
  const promptBuilder = new PromptBuilder();
  const rawTrackedPath = path.posix.join(config.paths.raw, 'tracked', sourceRelativePath);
  const rawAbsolutePath = path.join(config.wikiRoot, rawTrackedPath);

  if (!(await fs.pathExists(rawAbsolutePath))) {
    throw new Error(`Tracked source not found: ${rawTrackedPath}`);
  }

  const rawContent = await fs.readFile(rawAbsolutePath, 'utf8');
  const contentHash = computeContentHash(rawContent);
  const sourceId = rawTrackedPath;
  const sourcePagePath = deriveSourcePagePath(sourceRelativePath);

  const [sourcesState, conceptsState, indexContent] = await Promise.all([
    stateStore.loadSources(),
    stateStore.loadConcepts(),
    readIndexContent(config),
  ]);

  const previousState = sourcesState[sourceId];
  const previousConceptIds = previousState?.declaredConcepts.map(concept => concept.id) || [];
  if (previousState?.contentHash === contentHash) {
    return {
      sourceId,
      rawPath: rawTrackedPath,
      sourcePagePath,
      changed: false,
      affectedConceptIds: [],
      rebuiltConcepts: [],
    };
  }

  const existingSourceContent = await readOptionalFile(path.join(config.wikiRoot, sourcePagePath));
  const prompt = await promptBuilder.buildSourceRefreshPrompt({
    sourcePath: rawTrackedPath,
    sourcePagePath,
    rawContent,
    indexContent,
    existingSourceContent,
  });

  if (options.debug) {
    console.log(prompt);
  }

  const response = await llm.chat([{ role: 'user', content: prompt }]);
  if (!response) {
    throw new Error(`No response from model while refreshing ${rawTrackedPath}`);
  }

  const parsed = parseJsonResponse<SourceRefreshPlan>(response);
  const normalizedConcepts = normalizeConceptRefs(parsed.concepts || []);
  const affectedConceptIds = new Set<string>([
    ...previousConceptIds,
    ...normalizedConcepts.map(concept => concept.id),
  ]);

  if (!options.dryRun) {
    const transactionId = makeTransactionId();
    await safeWriteFile(path.join(config.wikiRoot, sourcePagePath), ensureTrailingNewline(parsed.sourceContent));

    sourcesState[sourceId] = {
      sourceId,
      rawPath: rawTrackedPath,
      sourcePagePath,
      contentHash,
      lastRefreshAt: new Date().toISOString(),
      lastTransactionId: transactionId,
      declaredConcepts: normalizedConcepts,
    };

    syncConceptMembership(conceptsState, sourceId, normalizedConcepts);
    await Promise.all([
      stateStore.saveSources(sourcesState),
      stateStore.saveConcepts(conceptsState),
    ]);
  }

  const rebuiltConcepts: RebuildConceptResult[] = [];
  if (options.cascade) {
    for (const conceptId of Array.from(affectedConceptIds).sort()) {
      if (!conceptsState[conceptId] || conceptsState[conceptId].sourceIds.length === 0) {
        const deleted = await removeConceptIfUnowned(config, conceptId, options.dryRun);
        rebuiltConcepts.push({
          conceptId,
          title: conceptId,
          conceptPagePath: deriveConceptPagePath(conceptId),
          sourceIds: [],
          changed: deleted,
        });
        continue;
      }
      const result = await rebuildConcept(
        config,
        conceptId,
        {
          ...options,
          conceptsState,
          sourcesState,
          sourceIdHint: sourceId,
        }
      );
      rebuiltConcepts.push(result);
    }
  }

  if (!options.dryRun) {
    await syncIndex(config);
  }

  return {
    sourceId,
    rawPath: rawTrackedPath,
    sourcePagePath,
    changed: true,
    affectedConceptIds: Array.from(affectedConceptIds).sort(),
    rebuiltConcepts,
  };
}

export async function rebuildConcept(
  config: Config,
  conceptId: string,
  options: WorkflowOptions & {
    conceptsState?: Record<string, ConceptStateRecord>;
    sourcesState?: Record<string, SourceStateRecord>;
    sourceIdHint?: string;
  } = {}
): Promise<RebuildConceptResult> {
  const normalizedConceptId = sanitizeConceptId(conceptId);
  if (!normalizedConceptId) {
    throw new Error(`Invalid concept id: ${conceptId}`);
  }

  const stateStore = new StateStore(config);
  const conceptsState = options.conceptsState || await stateStore.loadConcepts();
  const sourcesState = options.sourcesState || await stateStore.loadSources();
  const conceptState = conceptsState[normalizedConceptId];

  if (!conceptState || conceptState.sourceIds.length === 0) {
    throw new Error(`No tracked sources registered for concept: ${normalizedConceptId}`);
  }

  const llm = new LLMClient(config);
  const promptBuilder = new PromptBuilder();
  const indexContent = await readIndexContent(config);
  const currentConceptPagePath = conceptState.conceptPagePath || deriveConceptPagePath(normalizedConceptId);
  const currentConceptContent = await readOptionalFile(path.join(config.wikiRoot, currentConceptPagePath));

  const sourcePages = await Promise.all(
    conceptState.sourceIds
      .map((sourceId) => sourcesState[sourceId])
      .filter((record): record is SourceStateRecord => Boolean(record))
      .map(async (record) => ({
        sourceId: record.sourceId,
        sourcePath: record.rawPath,
        sourcePagePath: record.sourcePagePath,
        content: await fs.readFile(path.join(config.wikiRoot, record.sourcePagePath), 'utf8'),
      }))
  );

  const prompt = await promptBuilder.buildConceptRebuildPrompt({
    conceptId: normalizedConceptId,
    conceptTitle: conceptState.title,
    conceptPagePath: currentConceptPagePath,
    indexContent,
    currentConceptContent,
    sourcePages,
  });

  if (options.debug) {
    console.log(prompt);
  }

  const response = await llm.chat([{ role: 'user', content: prompt }]);
  if (!response) {
    throw new Error(`No response from model while rebuilding concept ${normalizedConceptId}`);
  }

  const parsed = parseJsonResponse<ConceptRebuildPlan>(response);
  const nextContent = ensureTrailingNewline(parsed.content);
  const previousContent = currentConceptContent ? ensureTrailingNewline(currentConceptContent) : '';
  const changed = previousContent !== nextContent;

  if (!options.dryRun) {
    await safeWriteFile(path.join(config.wikiRoot, currentConceptPagePath), nextContent);
    conceptsState[normalizedConceptId] = {
      conceptId: normalizedConceptId,
      title: conceptState.title,
      conceptPagePath: currentConceptPagePath,
      sourceIds: conceptState.sourceIds,
      lastRebuildAt: new Date().toISOString(),
    };
    await stateStore.saveConcepts(conceptsState);
    await syncIndex(config);
  }

  return {
    conceptId: normalizedConceptId,
    title: conceptState.title,
    conceptPagePath: currentConceptPagePath,
    sourceIds: [...conceptState.sourceIds],
    changed,
  };
}

export async function syncIndex(config: Config): Promise<void> {
  const wikiDir = path.join(config.wikiRoot, config.paths.wiki);
  const sections = [
    { title: 'Entities', dir: path.join(wikiDir, 'entities') },
    { title: 'Concepts', dir: path.join(wikiDir, 'concepts') },
    { title: 'Sources', dir: path.join(wikiDir, 'sources') },
    { title: 'Answers', dir: path.join(wikiDir, 'answers') },
  ];

  const lines = [
    '# Wiki Index',
    '',
    'This is the auto-generated index of your wiki.',
    '',
  ];

  for (const section of sections) {
    lines.push(`## ${section.title}`);
    const files = await collectMarkdownFiles(section.dir);
    if (files.length === 0) {
      lines.push(`*No ${section.title.toLowerCase()} yet.*`, '');
      continue;
    }

    for (const relativePath of files.sort()) {
      const absolutePath = path.join(section.dir, relativePath);
      const target = path.basename(relativePath, '.md');
      const label = await inferPageTitle(absolutePath, target);
      lines.push(`- [[${target}|${label}]]`);
    }
    lines.push('');
  }

  await safeWriteFile(path.join(wikiDir, 'index.md'), `${lines.join('\n').trimEnd()}\n`);
}

function normalizeConceptRefs(concepts: Array<{ id: string; title: string }>): TrackedConceptRef[] {
  const deduped = new Map<string, TrackedConceptRef>();
  for (const concept of concepts) {
    const id = sanitizeConceptId(concept.id || concept.title);
    const title = String(concept.title || concept.id || '').trim();
    if (!id || !title) continue;
    deduped.set(id, { id, title });
  }
  return Array.from(deduped.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function syncConceptMembership(
  conceptsState: Record<string, ConceptStateRecord>,
  sourceId: string,
  nextConcepts: TrackedConceptRef[]
): void {
  const nextIds = new Set(nextConcepts.map(concept => concept.id));

  for (const concept of Object.values(conceptsState)) {
    if (!concept.sourceIds.includes(sourceId)) continue;
    concept.sourceIds = concept.sourceIds.filter(id => id !== sourceId);
    if (concept.sourceIds.length === 0 && !nextIds.has(concept.conceptId)) {
      delete conceptsState[concept.conceptId];
    }
  }

  for (const concept of nextConcepts) {
    const existing = conceptsState[concept.id];
    const sourceIds = new Set(existing?.sourceIds || []);
    sourceIds.add(sourceId);
    conceptsState[concept.id] = {
      conceptId: concept.id,
      title: concept.title,
      conceptPagePath: existing?.conceptPagePath || deriveConceptPagePath(concept.id),
      sourceIds: Array.from(sourceIds).sort(),
      lastRebuildAt: existing?.lastRebuildAt,
    };
  }
}

async function inferPageTitle(filePath: string, fallback: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const heading = content.match(/^#\s+(.+)$/m);
    return heading?.[1]?.trim() || fallback;
  } catch {
    return fallback;
  }
}

async function readIndexContent(config: Config): Promise<string> {
  const indexPath = path.join(config.wikiRoot, config.paths.wiki, 'index.md');
  return readOptionalFile(indexPath) || '# Wiki Index\n\nEmpty index.\n';
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  if (!(await fs.pathExists(filePath))) return undefined;
  return fs.readFile(filePath, 'utf8');
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}

async function removeConceptIfUnowned(config: Config, conceptId: string, dryRun?: boolean): Promise<boolean> {
  const conceptPagePath = path.join(config.wikiRoot, deriveConceptPagePath(conceptId));
  const exists = await fs.pathExists(conceptPagePath);
  if (!exists) return false;
  if (!dryRun) {
    await fs.remove(conceptPagePath);
  }
  return true;
}
