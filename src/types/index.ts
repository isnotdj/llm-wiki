export interface Config {
  wikiRoot: string;
  llm: {
    provider: 'openai';
    model: string;
    apiKey?: string;
    baseUrl?: string;
    temperature: number;
  };
  paths: {
    raw: string;
    wiki: string;
    templates: string;
  };
}
