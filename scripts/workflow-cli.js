#!/usr/bin/env node

/**
 * Workflow CLI - Command line interface for CLAUDE.md → task → checkpoint workflow
 *
 * Usage:
 *   node scripts/workflow-cli.js create-task "Task Title" --section "Section Path"
 *   node scripts/workflow-cli.js list-sections
 *   node scripts/workflow-cli.js create-checkpoint task-001 "Checkpoint Title"
 *   node scripts/workflow-cli.js complete-checkpoint task-001 checkpoint-001
 */

import { program } from 'commander';
import chalk from 'chalk';
import HierarchyManager from '../lib/workflow/hierarchy-manager.js';
import fs from 'fs/promises';
import path from 'path';

const hierarchyManager = new HierarchyManager();

program
  .name('workflow')
  .description('CLI for managing CLAUDE.md → task → checkpoint workflow')
  .version('1.0.0');

// List CLAUDE.md sections
program
  .command('list-sections')
  .description('List all linkable sections in CLAUDE.md')
  .action(async () => {
    try {
      const sections = await hierarchyManager.parseClaudeMd();

      console.log(chalk.blue('\n📚 CLAUDE.md Sections:\n'));

      let currentTopLevel = '';
      sections.forEach(section => {
        const topLevel = section.path.split(' → ')[0];

        if (topLevel !== currentTopLevel) {
          currentTopLevel = topLevel;
          console.log(chalk.yellow(`\n${topLevel}`));
        }

        const indent = '  '.repeat(section.level - 1);
        console.log(`${indent}${chalk.gray(section.id)} ${section.title}`);
      });

      console.log(chalk.gray('\n💡 Use either the ID or full path when creating tasks\n'));
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
      process.exit(1);
    }
  });

// Create task
program
  .command('create-task <title>')
  .description('Create a new task linked to CLAUDE.md')
  .option('-s, --section <section>', 'CLAUDE.md section ID or path')
  .option('-d, --description <desc>', 'Task description')
  .option('-o, --objective <obj>', 'Task objective')
  .action(async (title, options) => {
    try {
      let description = options.description || title;

      // If no section provided, suggest sections
      if (!options.section) {
        console.log(chalk.yellow('\n⚠️  No CLAUDE.md section specified\n'));

        const suggestions = await hierarchyManager.suggestClaudeMdSection(title, description);

        if (suggestions.length > 0) {
          console.log(chalk.blue('📋 Suggested sections based on your task:\n'));
          suggestions.forEach((s, i) => {
            console.log(`  ${i + 1}. ${chalk.cyan(s.path)} (relevance: ${s.relevance})`);
          });
          console.log(chalk.gray('\nRun again with --section flag to specify a section'));
        } else {
          console.log(chalk.gray('No suggestions found. List all sections with: workflow list-sections'));
        }

        return;
      }

      // Create the task
      const result = await hierarchyManager.createTask({
        title,
        description,
        objective: options.objective,
        claudeMdSection: options.section
      });

      console.log(chalk.green('\n✅ Task created successfully!\n'));
      console.log(`  📁 Task ID: ${chalk.cyan(result.taskId)}`);
      console.log(`  📍 Location: ${chalk.gray(result.taskPath)}`);
      console.log(`  🔗 Linked to: ${chalk.blue(result.metadata.claudeMdLink.sectionPath)}`);
      console.log(chalk.gray(`\n💡 Next: Create checkpoints with: workflow create-checkpoint ${result.taskId} "Checkpoint Title"\n`));

    } catch (error) {
      console.error(chalk.red('\n❌ Error:', error.message));
      process.exit(1);
    }
  });

// Create checkpoint
program
  .command('create-checkpoint <taskId> <title>')
  .description('Create a checkpoint within a task')
  .option('-o, --objective <obj>', 'Checkpoint objective')
  .action(async (taskId, title, options) => {
    try {
      const result = await hierarchyManager.createCheckpoint(taskId, {
        title,
        objective: options.objective || `Complete: ${title}`
      });

      console.log(chalk.green('\n✅ Checkpoint created successfully!\n'));
      console.log(`  📌 Checkpoint ID: ${chalk.cyan(result.checkpointId)}`);
      console.log(`  📁 Parent Task: ${chalk.blue(result.parentTask)}`);
      console.log(`  📍 Location: ${chalk.gray(result.checkpointPath)}`);
      console.log(chalk.gray(`\n💡 Next: Complete work and run: workflow complete-checkpoint ${taskId} ${result.checkpointId}\n`));

    } catch (error) {
      console.error(chalk.red('\n❌ Error:', error.message));
      process.exit(1);
    }
  });

// Complete checkpoint
program
  .command('complete-checkpoint <taskId> <checkpointId>')
  .description('Mark a checkpoint as complete')
  .option('--validation <json>', 'Validation results as JSON')
  .action(async (taskId, checkpointId, options) => {
    try {
      let validationResults = {
        eslint: true,
        tests: true,
        accessibility: true,
        sacredPrinciples: true
      };

      if (options.validation) {
        validationResults = JSON.parse(options.validation);
      }

      const result = await hierarchyManager.updateCheckpointStatus(
        taskId,
        checkpointId,
        'complete',
        validationResults
      );

      console.log(chalk.green('\n✅ Checkpoint marked as complete!\n'));
      console.log(`  📌 Checkpoint: ${chalk.cyan(checkpointId)}`);
      console.log(`  📊 Task Status: ${chalk.blue(result.taskStatus)}`);

      if (result.allCheckpointsComplete) {
        console.log(chalk.yellow('\n🎉 All checkpoints complete! Task is ready for merge.\n'));
        console.log(chalk.gray('💡 A merge proposal has been generated for project.md updates\n'));
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error:', error.message));
      process.exit(1);
    }
  });

// List tasks
program
  .command('list-tasks')
  .description('List all tasks and their status')
  .action(async () => {
    try {
      const tasksDir = path.join(process.cwd(), 'tasks');
      const entries = await fs.readdir(tasksDir).catch(() => []);

      if (entries.length === 0) {
        console.log(chalk.gray('\nNo tasks found. Create one with: workflow create-task "Task Title"\n'));
        return;
      }

      console.log(chalk.blue('\n📋 Tasks:\n'));

      for (const entry of entries.sort()) {
        if (!entry.startsWith('task-')) continue;

        try {
          const metadataPath = path.join(tasksDir, entry, '.task-metadata.json');
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

          const checkpointStats = metadata.checkpoints.reduce((acc, c) => {
            acc[c.status] = (acc[c.status] || 0) + 1;
            return acc;
          }, {});

          console.log(`${chalk.cyan(entry)}`);
          console.log(`  Status: ${chalk.yellow(metadata.status)}`);
          console.log(`  Linked to: ${chalk.blue(metadata.claudeMdLink.sectionPath)}`);
          console.log(`  Checkpoints: ${metadata.checkpoints.length} total`);

          if (metadata.checkpoints.length > 0) {
            const parts = [];
            if (checkpointStats.complete) parts.push(`${checkpointStats.complete} complete`);
            if (checkpointStats.pending) parts.push(`${checkpointStats.pending} pending`);
            if (checkpointStats['in-progress']) parts.push(`${checkpointStats['in-progress']} in progress`);
            console.log(`    ${chalk.gray(parts.join(', '))}`);
          }

          console.log('');
        } catch (error) {
          console.log(`  ${chalk.red('Error reading task metadata')}\n`);
        }
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error:', error.message));
      process.exit(1);
    }
  });

// Show task details
program
  .command('show-task <taskId>')
  .description('Show detailed information about a task')
  .action(async (taskId) => {
    try {
      const taskPath = await hierarchyManager.findTaskPath(taskId);
      if (!taskPath) {
        throw new Error(`Task ${taskId} not found`);
      }

      const metadataPath = path.join(taskPath, '.task-metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      const taskMd = await fs.readFile(path.join(taskPath, 'task.md'), 'utf-8');

      console.log(chalk.blue(`\n📋 Task: ${taskId}\n`));
      console.log(chalk.gray(taskMd));

      if (metadata.checkpoints.length > 0) {
        console.log(chalk.yellow('\n📌 Checkpoints:\n'));
        metadata.checkpoints.forEach((checkpoint, i) => {
          const statusColor = checkpoint.status === 'complete' ? 'green' :
            checkpoint.status === 'in-progress' ? 'yellow' : 'gray';
          console.log(`  ${i + 1}. ${chalk[statusColor](checkpoint.status.toUpperCase())} ${checkpoint.title}`);
          console.log(`     ID: ${chalk.gray(checkpoint.id)}`);
        });
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error:', error.message));
      process.exit(1);
    }
  });

program.parse();
