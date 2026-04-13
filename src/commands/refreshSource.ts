import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  collectMarkdownFiles,
  refreshTrackedSource,
} from '../core/trackedWorkflow.ts';
import type { Config } from '../types/index.ts';

export default async function refreshSourceCmd(
  config: Config,
  file: string | undefined,
  options: { all?: boolean; cascade?: boolean; yes?: boolean; dryRun?: boolean; debug?: boolean }
) {
  const trackedDir = path.resolve(config.wikiRoot, config.paths.raw, 'tracked');
  const trackedFiles = await collectMarkdownFiles(trackedDir);

  if (trackedFiles.length === 0) {
    console.log(chalk.yellow('No tracked raw files found.'));
    return;
  }

  let selectedFiles: string[] = [];

  if (file) {
    selectedFiles = [file];
  } else if (options.all) {
    selectedFiles = trackedFiles;
  } else {
    const { choices } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'choices',
      message: 'Select tracked raw files to refresh:',
      choices: trackedFiles,
    }]);
    selectedFiles = choices;
  }

  if (selectedFiles.length === 0) return;

  for (const selectedFile of selectedFiles) {
    console.log(chalk.blue(`\nRefreshing ${selectedFile}...`));

    try {
      if (!options.yes && !options.dryRun) {
        const { proceed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceed',
          message: `Refresh ${selectedFile}${options.cascade ? ' and rebuild affected concepts' : ''}?`,
          default: true,
        }]);
        if (!proceed) {
          console.log(chalk.yellow(`Skipped ${selectedFile}.`));
          continue;
        }
      }

      const result = await refreshTrackedSource(config, selectedFile, options);

      if (!result.changed) {
        console.log(chalk.gray(`No content change detected for raw/tracked/${selectedFile}.`));
        continue;
      }

      console.log(chalk.green(`Updated ${result.sourcePagePath}`));
      if (result.affectedConceptIds.length > 0) {
        console.log(chalk.cyan(`Affected concepts: ${result.affectedConceptIds.join(', ')}`));
      }
      if (result.affectedEntityIds.length > 0) {
        console.log(chalk.magenta(`Affected entities: ${result.affectedEntityIds.join(', ')}`));
      }
      if (options.cascade && result.rebuiltConcepts.length > 0) {
        for (const rebuilt of result.rebuiltConcepts) {
          const status = rebuilt.changed ? 'rebuilt' : 'unchanged';
          console.log(chalk.green(`  - ${rebuilt.conceptPagePath} (${status})`));
        }
      }
      if (options.cascade && result.rebuiltEntities.length > 0) {
        for (const rebuilt of result.rebuiltEntities) {
          const status = rebuilt.changed ? 'rebuilt' : 'unchanged';
          console.log(chalk.magenta(`  - ${rebuilt.entityPagePath} (${status})`));
        }
      }
      if (options.dryRun) {
        console.log(chalk.yellow('Dry run only. No files were written.'));
      }
    } catch (error) {
      console.error(chalk.red(`Failed to refresh ${selectedFile}:`), error);
    }
  }
}
