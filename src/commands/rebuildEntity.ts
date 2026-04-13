import chalk from 'chalk';
import inquirer from 'inquirer';
import { StateStore } from '../core/stateStore.ts';
import { rebuildEntity } from '../core/trackedWorkflow.ts';
import type { Config } from '../types/index.ts';

export default async function rebuildEntityCmd(
  config: Config,
  entity: string | undefined,
  options: { all?: boolean; yes?: boolean; dryRun?: boolean; debug?: boolean }
) {
  const stateStore = new StateStore(config);
  const entities = await stateStore.loadEntities();
  const knownEntityIds = Object.keys(entities).sort();

  if (knownEntityIds.length === 0) {
    console.log(chalk.yellow('No tracked entities found. Refresh a tracked source first.'));
    return;
  }

  let selectedEntities: string[] = [];
  if (entity) {
    selectedEntities = [entity];
  } else if (options.all) {
    selectedEntities = knownEntityIds;
  } else {
    const { choices } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'choices',
      message: 'Select entities to rebuild:',
      choices: knownEntityIds,
    }]);
    selectedEntities = choices;
  }

  if (selectedEntities.length === 0) return;

  for (const entityId of selectedEntities) {
    try {
      if (!options.yes && !options.dryRun) {
        const { proceed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceed',
          message: `Rebuild entity ${entityId}?`,
          default: true,
        }]);
        if (!proceed) {
          console.log(chalk.yellow(`Skipped ${entityId}.`));
          continue;
        }
      }

      const result = await rebuildEntity(config, entityId, options);
      const status = result.changed ? 'updated' : 'unchanged';
      console.log(chalk.green(`${result.entityPagePath} ${status}`));
      if (options.dryRun) {
        console.log(chalk.yellow('Dry run only. No files were written.'));
      }
    } catch (error) {
      console.error(chalk.red(`Failed to rebuild entity ${entityId}:`), error);
    }
  }
}
