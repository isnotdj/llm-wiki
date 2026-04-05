import type { Config } from '../types/index.ts';

export const defaultConfig: Config = {
  wikiRoot: '.',
  llm: {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.3,
  },
  paths: {
    raw: 'raw',
    wiki: 'wiki',
    templates: 'templates',
  },
};
