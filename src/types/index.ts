export interface Config {
  wikiRoot: string;
  llm: {
    provider: 'openai' | 'anthropic';
    model: string;
    apiKey?: string;
    baseUrl?: string;
    apiVersion?: string;
    maxTokens?: number;
    temperature: number;
    thinking?: {
      type: 'disabled' | 'enabled';
      budget_tokens?: number;
    };
  };
  paths: {
    raw: string;
    wiki: string;
    templates: string;
  };
}
