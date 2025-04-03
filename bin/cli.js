#!/usr/bin/env node

const { program } = require('commander');
const setup = require('../src/commands/setup');
const newtask = require('../src/commands/newtask');
const endtask = require('../src/commands/endtask');
const updateReadme = require('../src/commands/updateReadme');
const packageInfo = require('../package.json');

program
  .name('flagtrack')
  .description('CTF Progress Tracker and Task Management Tool')
  .version(packageInfo.version);

program
  .command('setup')
  .description('Set up a new CTF project with required configuration')
  .action(setup);

program
  .command('newtask')
  .description('Create a new CTF challenge task')
  .action(newtask);

program
  .command('endtask')
  .description('Check or set flag for completed task')
  .action(endtask);

program
  .command('update')
  .description('Update the README with the current CTF progress')
  .action(updateReadme);

program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
