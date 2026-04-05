import { cosmiconfig } from 'cosmiconfig';
import YAML from 'yaml';
import { defaultConfig } from './defaultConfig.ts';
import type { Config } from '../types/index.ts';

export async function loadConfig(): Promise<Config> {
  const explorer = cosmiconfig('wiki', {
    searchPlaces: [
      'package.json',
      '.wikirc',
      '.wikirc.json',
      '.wikirc.yaml',
      '.wikirc.yml',
      '.wikirc.js',
      '.wikirc.cjs',
      'wiki.config.js',
      'wiki.config.cjs',
    ],
    loaders: {
      '.yaml': (filePath, content) => YAML.parse(content),
      '.yml': (filePath, content) => YAML.parse(content),
      noExt: (filePath, content) => YAML.parse(content),
    },
  });

  try {
    const result = await explorer.search();
    if (result && !result.isEmpty) {
      // Merge with defaults
      return {
        ...defaultConfig,
        ...result.config,
        llm: {
          ...defaultConfig.llm,
          ...result.config?.llm,
        },
        paths: {
          ...defaultConfig.paths,
          ...result.config?.paths,
        },
      };
    }
  } catch (error) {
    console.warn('Failed to load cosmiconfig, using defaults.', error);
  }
  return defaultConfig;
}
