import OpenAI from 'openai';
import type { Config } from '../types/index.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LLMClient {
  private client?: OpenAI;
  private config: Config;
  private apiKey?: string;

  constructor(config: Config) {
    this.config = config;
    this.apiKey = config.llm.apiKey || this.getEnvApiKey();

    if (config.llm.provider === 'openai') {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: config.llm.baseUrl, // Essential for proxies
      });
    }
  }

  async chat(messages: ChatMessage[]): Promise<string | null> {
    if (this.config.llm.provider === 'anthropic') {
      return this.chatAnthropic(messages);
    }

    if (!this.client) {
      throw new Error('OpenAI client is not initialized.');
    }

    const response = await this.client.chat.completions.create({
      model: this.config.llm.model,
      messages,
      temperature: this.config.llm.temperature,
      max_tokens: this.config.llm.maxTokens,
      thinking: this.config.llm.thinking,
    } as any);

    return response.choices[0]?.message?.content || null;
  }

  private getEnvApiKey(): string | undefined {
    if (this.config.llm.provider === 'anthropic') {
      return process.env.ANTHROPIC_API_KEY;
    }
    return process.env.OPENAI_API_KEY;
  }

  private async chatAnthropic(messages: ChatMessage[]): Promise<string | null> {
    if (!this.apiKey) {
      throw new Error('Missing API key for Anthropic provider. Set llm.apiKey or ANTHROPIC_API_KEY.');
    }

    const system = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');

    const anthropicMessages = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const response = await fetch(`${this.getAnthropicBaseUrl()}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.config.llm.apiVersion || '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.llm.model,
        max_tokens: this.config.llm.maxTokens ?? 4096,
        temperature: this.config.llm.temperature,
        system: system || undefined,
        messages: anthropicMessages,
        thinking: this.config.llm.thinking?.type === 'enabled'
          ? this.config.llm.thinking
          : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    };

    const textBlocks = data.content
      ?.filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text);

    return textBlocks?.join('\n') || null;
  }

  private getAnthropicBaseUrl(): string {
    const configured = this.config.llm.baseUrl || 'https://api.anthropic.com';
    return configured.endsWith('/') ? configured.slice(0, -1) : configured;
  }
}
