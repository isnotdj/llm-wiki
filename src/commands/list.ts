import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import type { Config } from '../types/index.ts';

async function scanMdFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  if (!(await fs.pathExists(dir))) return results;
  
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await scanMdFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

export default async function listCmd(config: Config, type: string, target: string, options: any) {
  const wikiDir = path.join(config.wikiRoot, config.paths.wiki);
  const rawUntrackedDir = path.join(config.wikiRoot, config.paths.raw, 'untracked');
  const rawIngestedDir = path.join(config.wikiRoot, config.paths.raw, 'ingested');

  switch (type.toLowerCase()) {
    case 'raw': {
      console.log(chalk.bold.cyan('\n--- Raw Sources ---'));
      
      const untracked = await scanMdFiles(rawUntrackedDir);
      console.log(chalk.yellow(`\nPending / Untracked (${untracked.length}):`));
      untracked.forEach(f => console.log(`  - ${path.relative(config.wikiRoot, f)}`));

      const ingested = await scanMdFiles(rawIngestedDir);
      console.log(chalk.green(`\nIngested (${ingested.length}):`));
      ingested.forEach(f => console.log(`  - ${path.relative(config.wikiRoot, f)}`));
      console.log('');
      break;
    }
    
    case 'pages': {
      console.log(chalk.bold.cyan('\n--- Wiki Pages ---'));
      const allWikiFiles = await scanMdFiles(wikiDir);
      const filtered = allWikiFiles.filter(f => !['index.md', 'log.md'].includes(path.basename(f)));
      
      filtered.forEach(f => {
         const name = path.basename(f, '.md');
         console.log(`  📄 ${chalk.green(name)} ${chalk.gray(`(${path.relative(config.wikiRoot, f)})`)}`);
      });
      console.log(chalk.gray(`\nTotal: ${filtered.length} pages\n`));
      break;
    }
    
    case 'orphans': {
      console.log(chalk.bold.cyan('\n--- Orphan Pages ---'));
      const allWikiFiles = await scanMdFiles(wikiDir);
      const pageFiles = allWikiFiles.filter(f => !['index.md', 'log.md'].includes(path.basename(f)));
      
      const pageNames = pageFiles.map(f => path.basename(f, '.md'));
      const orphans = new Set(pageNames);

      // Scan content of index and all wiki pages
      const allContentFiles = [path.join(wikiDir, 'index.md'), ...pageFiles];
      
      for (const file of allContentFiles) {
        if (!(await fs.pathExists(file))) continue;
        const content = await fs.readFile(file, 'utf8');
        
        // Match standard [[Links]]
        const matches = [...content.matchAll(/\[\[(.*?)\]\]/g)];
        for (const match of matches) {
           orphans.delete(match[1].trim());
        }
      }

      if (orphans.size === 0) {
         console.log(chalk.green('\nNo orphan pages found! Every page is linked. 🎉\n'));
      } else {
         console.log(chalk.yellow(`\nFound ${orphans.size} orphan pages (no incoming links):\n`));
         Array.from(orphans).forEach(name => console.log(`  - ${name}`));
         console.log(chalk.gray(`\nTip: You can use 'wiki lint' to have the LLM automatically restructure or connect them.\n`));
      }
      break;
    }
    
    case 'backlinks': {
       if (!target) {
          console.log(chalk.red('Please provide a target page name. Usage: wiki list backlinks "Page Name"'));
          return;
       }
       console.log(chalk.bold.cyan(`\n--- Backlinks for "[[${target}]]" ---`));
       
       const allWikiFiles = await scanMdFiles(wikiDir);
       let found = 0;

       for (const file of allWikiFiles) {
          if (!(await fs.pathExists(file))) continue;
          const content = await fs.readFile(file, 'utf8');
          // simple check for link
          if (content.includes(`[[${target}]]`)) {
             console.log(`  🔗 ${chalk.green(path.basename(file, '.md'))}`);
             found++;
          }
       }

       if (found === 0) {
          console.log(chalk.gray(`\nNo pages link to "[[${target}]]".\n`));
       } else {
          console.log(chalk.gray(`\nTotal: ${found} referring pages\n`));
       }
       break;
    }

    default:
      console.log(chalk.red(`\nUnknown list type: ${type}`));
      console.log(`Supported types: raw, pages, orphans, backlinks\n`);
  }
}
