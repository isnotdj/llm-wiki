import type { Config } from '../types/index.ts';

export const defaultConfig: Config = {
  wikiRoot: '.',
  llm: {
    provider: 'openai',
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    maxTokens: 4096,
    temperature: 0.3,
    thinking: {
      type: 'disabled',
    },
  },
  paths: {
    raw: 'raw',
    wiki: 'wiki',
    templates: 'templates',
  },
};
