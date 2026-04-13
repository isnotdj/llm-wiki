import fs from 'fs-extra';
import path from 'path';
import Handlebars from 'handlebars';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PromptBuilder {
  private agentSchemaPath: string;
  private ingestTemplatePath: string;
  private queryAgentTemplatePath: string;
  private lintTemplatePath: string;
  private sourceRefreshTemplatePath: string;
  private conceptRebuildTemplatePath: string;

  constructor() {
    this.agentSchemaPath = path.resolve(__dirname, '../schemas/agent.md');
    this.ingestTemplatePath = path.resolve(__dirname, '../schemas/ingest.prompt.hbs');
    this.queryAgentTemplatePath = path.resolve(__dirname, '../schemas/query_agent.prompt.hbs');
    this.lintTemplatePath = path.resolve(__dirname, '../schemas/lint.prompt.hbs');
    this.sourceRefreshTemplatePath = path.resolve(__dirname, '../schemas/source_refresh.prompt.hbs');
    this.conceptRebuildTemplatePath = path.resolve(__dirname, '../schemas/concept_rebuild.prompt.hbs');
  }

  async buildIngestPrompt(data: {
    sourcePath: string;
    rawContent: string;
    indexContent: string;
    relevantPages: Array<{ title: string; content: string }>;
  }): Promise<string> {
    const agentSystemPrompt = await fs.readFile(this.agentSchemaPath, 'utf8');
    const ingestTplString = await fs.readFile(this.ingestTemplatePath, 'utf8');

    const template = Handlebars.compile(ingestTplString);
    return template({
      agentSystemPrompt,
      ...data,
    });
  }

  async buildQueryAgentPrompt(data: {
    question: string;
    indexContent: string;
    loadedPages: Array<{ name: string; content: string }>;
  }): Promise<string> {
    const tplString = await fs.readFile(this.queryAgentTemplatePath, 'utf8');
    const template = Handlebars.compile(tplString);
    return template(data);
  }

  async buildLintPrompt(data: {
    indexContent: string;
    pages: Array<{ name: string; content: string }>;
  }): Promise<string> {
    const tplString = await fs.readFile(this.lintTemplatePath, 'utf8');
    const template = Handlebars.compile(tplString);
    return template(data);
  }

  async buildSourceRefreshPrompt(data: {
    sourcePath: string;
    sourcePagePath: string;
    rawContent: string;
    indexContent: string;
    existingSourceContent?: string;
  }): Promise<string> {
    const agentSystemPrompt = await fs.readFile(this.agentSchemaPath, 'utf8');
    const tplString = await fs.readFile(this.sourceRefreshTemplatePath, 'utf8');
    const template = Handlebars.compile(tplString);
    return template({
      agentSystemPrompt,
      ...data,
    });
  }

  async buildConceptRebuildPrompt(data: {
    conceptId: string;
    conceptTitle: string;
    conceptPagePath: string;
    indexContent: string;
    currentConceptContent?: string;
    sourcePages: Array<{ sourceId: string; sourcePath: string; sourcePagePath: string; content: string }>;
  }): Promise<string> {
    const agentSystemPrompt = await fs.readFile(this.agentSchemaPath, 'utf8');
    const tplString = await fs.readFile(this.conceptRebuildTemplatePath, 'utf8');
    const template = Handlebars.compile(tplString);
    return template({
      agentSystemPrompt,
      ...data,
    });
  }
}
