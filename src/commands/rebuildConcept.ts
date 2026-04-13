import chalk from 'chalk';
import inquirer from 'inquirer';
import { StateStore } from '../core/stateStore.ts';
import { rebuildConcept } from '../core/trackedWorkflow.ts';
import type { Config } from '../types/index.ts';

export default async function rebuildConceptCmd(
  config: Config,
  concept: string | undefined,
  options: { all?: boolean; yes?: boolean; dryRun?: boolean; debug?: boolean }
) {
  const stateStore = new StateStore(config);
  const concepts = await stateStore.loadConcepts();
  const knownConceptIds = Object.keys(concepts).sort();

  if (knownConceptIds.length === 0) {
    console.log(chalk.yellow('No tracked concepts found. Refresh a tracked source first.'));
    return;
  }

  let selectedConcepts: string[] = [];
  if (concept) {
    selectedConcepts = [concept];
  } else if (options.all) {
    selectedConcepts = knownConceptIds;
  } else {
    const { choices } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'choices',
      message: 'Select concepts to rebuild:',
      choices: knownConceptIds,
    }]);
    selectedConcepts = choices;
  }

  if (selectedConcepts.length === 0) return;

  for (const conceptId of selectedConcepts) {
    try {
      if (!options.yes && !options.dryRun) {
        const { proceed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceed',
          message: `Rebuild concept ${conceptId}?`,
          default: true,
        }]);
        if (!proceed) {
          console.log(chalk.yellow(`Skipped ${conceptId}.`));
          continue;
        }
      }

      const result = await rebuildConcept(config, conceptId, options);
      const status = result.changed ? 'updated' : 'unchanged';
      console.log(chalk.green(`${result.conceptPagePath} ${status}`));
      if (options.dryRun) {
        console.log(chalk.yellow('Dry run only. No files were written.'));
      }
    } catch (error) {
      console.error(chalk.red(`Failed to rebuild concept ${conceptId}:`), error);
    }
  }
}
