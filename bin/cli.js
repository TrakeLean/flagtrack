#!/usr/bin/env node

const { program } = require('commander');
const setup = require('../src/commands/setup');
const create = require('../src/commands/create');
const solve = require('../src/commands/solve');
const leaderboard = require('../src/commands/leaderboard');
const updateReadme = require('../src/commands/updateReadme');
const packageInfo = require('../package.json');

program
  .name('flagtrack')
  .description('event Progress Tracker and Task Management Tool')
  .version(packageInfo.version);

program
  .command('setup')
  .description('Set up a new event project with required configuration')
  .action(setup);

program
  .command('create')
  .description('Create a new event challenge task')
  .action(create);

program
  .command('solve')
  .description('Check or set flag for completed task')
  .action(solve);

program
  .command('leaderboard')
  .description('Generate a leaderboard of challenge solvers')
  .action(leaderboard);

program
  .command('update')
  .description('Update the README with the current event progress')
  .action(updateReadme);

program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
