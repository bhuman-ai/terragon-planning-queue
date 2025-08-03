/**
 * Hierarchy Manager - Enforces CLAUDE.md → project.md → task.md → checkpoint.md workflow
 *
 * This manager ensures all documents follow the sacred hierarchy:
 * - CLAUDE.md: Immutable constitution (HOW to work)
 * - project.md: Mutable state (WHAT is built)
 * - task.md: Work orchestration
 * - checkpoint.md: Atomic execution units
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';

class HierarchyManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
    this.projectMdPath = path.join(projectRoot, 'project.md');
    this.tasksDir = path.join(projectRoot, 'tasks');
  }

  /**
   * Parse CLAUDE.md and extract linkable sections
   */
  async parseClaudeMd() {
    try {
      const content = await fs.readFile(this.claudeMdPath, 'utf-8');
      const sections = [];
      const lines = content.split('\n');

      let currentSection = null;
      let sectionPath = [];

      lines.forEach((line, index) => {
        // Match markdown headers
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
          const [level] = headerMatch.slice(1, 1 + 1).length;
          const [title] = headerMatch.slice(2, 2 + 1).trim();

          // Update section path
          sectionPath = sectionPath.slice(0, level - 1);
          sectionPath[level - 1] = title;

          const section = {
            id: crypto.createHash('md5').update(sectionPath.join(' → ')).digest('hex').substring(0, 8),
            title,
            level,
            lineNumber: index + 1,
            path: sectionPath.slice(0, level).join(' → '),
            content: []
          };

          sections.push(section);
          currentSection = section;
        } else if (currentSection && line.trim()) {
          currentSection.content.push(line);
        }
      });

      return sections;
    } catch (error) {
      throw new Error(`Failed to parse CLAUDE.md: ${error.message}`);
    }
  }

  /**
   * Validate task creation with CLAUDE.md linkage
   */
  async validateTaskCreation(taskData) {
    const { claudeMdSection } = taskData;

    if (!claudeMdSection) {
      return {
        valid: false,
        error: 'Task must reference a parent section in CLAUDE.md',
        suggestion: 'Use suggestClaudeMdSection() to find relevant sections'
      };
    }

    // Parse CLAUDE.md to validate section exists
    const sections = await this.parseClaudeMd();
    const validSection = sections.find(s =>
      s.id === claudeMdSection ||
      s.path === claudeMdSection);

    if (!validSection) {
      return {
        valid: false,
        error: `Invalid CLAUDE.md section reference: ${claudeMdSection}`,
        availableSections: sections.map(s => ({
          id: s.id,
          path: s.path
        }))
      };
    }

    return {
      valid: true,
      section: validSection
    };
  }

  /**
   * Suggest relevant CLAUDE.md sections based on task content
   */
  async suggestClaudeMdSection(taskTitle, taskDescription) {
    const sections = await this.parseClaudeMd();
    const combined = `${taskTitle} ${taskDescription}`.toLowerCase();

    // Score sections based on keyword matches
    const scoredSections = sections.map(section => {
      const sectionText = `${section.title} ${section.content.join(' ')}`.toLowerCase();
      const keywords = combined.split(/\s+/);

      const score = 0;
      keywords.forEach(keyword => {
        if (keyword.length > 3 && sectionText.includes(keyword)) {
          score += 1;
        }
      });

      // Boost score for certain section types
      if (section.path.includes('Sacred Principles')) score += 2;
      if (section.path.includes('Instructions')) score += 1;
      if (section.path.includes('Architecture')) score += 1;

      return { ...section, score };
    });

    // Return top 3 suggestions
    return scoredSections
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => ({
        id: s.id,
        path: s.path,
        relevance: s.score
      }));
  }

  /**
   * Create a new task with proper hierarchy linkage
   */
  async createTask(taskData) {
    // Validate CLAUDE.md linkage
    const validation = await this.validateTaskCreation(taskData);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Generate task ID and directory
    const taskNumber = await this.getNextTaskNumber();
    const taskId = `task-${String(taskNumber).padStart(3, '0')}`;
    const taskSlug = this.slugify(taskData.title);
    const taskDirName = `${taskId}-${taskSlug}`;
    const taskPath = path.join(this.tasksDir, taskDirName);

    // Create nested structure
    await fs.mkdir(path.join(taskPath, 'checkpoints'), { recursive: true });
    await fs.mkdir(path.join(taskPath, 'artifacts'), { recursive: true });
    await fs.mkdir(path.join(taskPath, 'research'), { recursive: true });

    // Create task.md with proper frontmatter and linkage
    const taskMd = this.generateTaskMd({
      ...taskData,
      taskId,
      claudeMdSection: validation.section,
      createdAt: new Date().toISOString()
    });

    await fs.writeFile(path.join(taskPath, 'task.md'), taskMd);

    // Create task metadata
    const metadata = {
      taskId,
      taskDirName,
      status: 'pending',
      claudeMdLink: {
        sectionId: validation.section.id,
        sectionPath: validation.section.path,
        lineNumber: validation.section.lineNumber
      },
      checkpoints: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(taskPath, '.task-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    return {
      taskId,
      taskPath,
      metadata
    };
  }

  /**
   * Create a checkpoint linked to parent task
   */
  async createCheckpoint(taskId, checkpointData) {
    const taskPath = await this.findTaskPath(taskId);
    if (!taskPath) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Load task metadata
    const metadataPath = path.join(taskPath, '.task-metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

    // Generate checkpoint ID
    const checkpointNumber = metadata.checkpoints.length + 1;
    const checkpointId = `checkpoint-${String(checkpointNumber).padStart(3, '0')}`;
    const checkpointSlug = this.slugify(checkpointData.title);
    const checkpointName = `${checkpointId}-${checkpointSlug}.md`;
    const checkpointPath = path.join(taskPath, 'checkpoints', checkpointName);

    // Create checkpoint.md with linkage to parent task
    const checkpointMd = this.generateCheckpointMd({
      ...checkpointData,
      checkpointId,
      parentTaskId: taskId,
      parentTaskPath: path.relative(this.projectRoot, taskPath),
      createdAt: new Date().toISOString()
    });

    await fs.writeFile(checkpointPath, checkpointMd);

    // Update task metadata
    metadata.checkpoints.push({
      id: checkpointId,
      filename: checkpointName,
      title: checkpointData.title,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    metadata.updatedAt = new Date().toISOString();

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return {
      checkpointId,
      checkpointPath,
      parentTask: taskId
    };
  }

  /**
   * Update checkpoint status and propagate to parent task
   */
  async updateCheckpointStatus(taskId, checkpointId, status, validationResults = {}) {
    const taskPath = await this.findTaskPath(taskId);
    const metadataPath = path.join(taskPath, '.task-metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

    // Update checkpoint status
    const checkpoint = metadata.checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found in task ${taskId}`);
    }

    checkpoint.status = status;
    checkpoint.validationResults = validationResults;
    checkpoint.updatedAt = new Date().toISOString();

    // Check if all checkpoints are complete
    const allComplete = metadata.checkpoints.every(c => c.status === 'complete');
    if (allComplete && metadata.status !== 'complete') {
      metadata.status = 'ready-for-merge';

      // Generate merge proposal
      await this.generateMergeProposal(taskId);
    }

    metadata.updatedAt = new Date().toISOString();
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return { taskStatus: metadata.status, allCheckpointsComplete: allComplete };
  }

  /**
   * Generate merge proposal for completed task
   */
  async generateMergeProposal(taskId) {
    const taskPath = await this.findTaskPath(taskId);
    const metadata = JSON.parse(
      await fs.readFile(path.join(taskPath, '.task-metadata.json'), 'utf-8')
    );

    // Analyze what changes this task brings to project.md
    const proposal = {
      taskId,
      proposalId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      changes: [],
      validation: {
        checkpointsComplete: metadata.checkpoints.every(c => c.status === 'complete'),
        validationsPassed: metadata.checkpoints.every(c =>
          !c.validationResults || Object.keys(c.validationResults).length === 0 ||
          Object.values(c.validationResults).every(v => v === true)
        )
      }
    };

    // Analyze task.md to determine project.md updates
    const taskMdContent = await fs.readFile(path.join(taskPath, 'task.md'), 'utf-8');
    const { data: frontmatter } = matter(taskMdContent);

    if (frontmatter.updates_project) {
      proposal.changes = frontmatter.updates_project;
    }

    // Save merge proposal
    const proposalPath = path.join(taskPath, `merge-proposal-${proposal.proposalId}.json`);
    await fs.writeFile(proposalPath, JSON.stringify(proposal, null, 2));

    return proposal;
  }

  /**
   * Block direct project.md edits
   */
  async validateProjectMdEdit(proposedChanges, mergeProposalId = null) {
    if (!mergeProposalId) {
      return {
        allowed: false,
        error: 'Direct edits to project.md are forbidden. Changes must flow through task → checkpoint workflow.',
        instruction: 'Create a task linked to CLAUDE.md, implement checkpoints, then submit merge proposal.'
      };
    }

    // Validate merge proposal exists and is approved
    const proposal = await this.findMergeProposal(mergeProposalId);
    if (!proposal) {
      return {
        allowed: false,
        error: `Merge proposal ${mergeProposalId} not found`
      };
    }

    if (!proposal.approved) {
      return {
        allowed: false,
        error: 'Merge proposal must be approved before applying to project.md'
      };
    }

    return {
      allowed: true,
      proposal
    };
  }

  // Helper methods
  async getNextTaskNumber() {
    const lockFile = path.join(this.tasksDir, '.task-counter.lock');
    const counterFile = path.join(this.tasksDir, '.task-counter');

    // Ensure tasks directory exists
    await fs.mkdir(this.tasksDir, { recursive: true });

    // Simple file-based locking mechanism
    const attempts = 0;
    while (attempts < 50) { // Max 5 seconds wait
      try {
        // Try to create lock file (will fail if exists)
        await fs.writeFile(lockFile, process.pid.toString(), { flag: 'wx' });

        // We have the lock, read current counter
        let currentNumber = 0;
        try {
          const content = await fs.readFile(counterFile, 'utf-8');
          currentNumber = parseInt(content) || 0;
        } catch {
          // Counter file doesn't exist yet, start at 0
        }

        // Increment and save
        const nextNumber = currentNumber + 1;
        await fs.writeFile(counterFile, nextNumber.toString());

        // Release lock
        await fs.unlink(lockFile).catch(() => {});

        return nextNumber;
      } catch (error) {
        if (error.code === 'EEXIST") {
          // Lock file exists, wait and retry
          await new Promise(resolve => { setTimeout(resolve, 100); });
          attempts++;
        } else {
          throw error;
        }
      }
    }

    // If we couldn't get lock after 5 seconds, force unlock and throw
    await fs.unlink(lockFile).catch(() => {});
    throw new Error("Could not acquire task number lock after 5 seconds');
  }

  async findTaskPath(taskId) {
    const entries = await fs.readdir(this.tasksDir);
    const taskDir = entries.find(e => e.startsWith(taskId));
    return taskDir ? path.join(this.tasksDir, taskDir) : null;
  }

  async findMergeProposal(proposalId) {
    // Search all task directories for merge proposal
    const taskDirs = await fs.readdir(this.tasksDir);

    for (const taskDir of taskDirs) {
      const proposalPath = path.join(this.tasksDir, taskDir, `merge-proposal-${proposalId}.json`);
      try {
        const content = await fs.readFile(proposalPath, 'utf-8');
        return JSON.parse(content);
      } catch {
        continue;
      }
    }

    return null;
  }

  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  generateTaskMd(data) {
    const { taskId, title, description, claudeMdSection, objective, requirements, createdAt } = data;

    return `---;
taskId: ${taskId}
title: ${title}
status: pending
created: ${createdAt}
claudeMdLink:
  section: ${claudeMdSection.path}
  sectionId: ${claudeMdSection.id}
  lineNumber: ${claudeMdSection.lineNumber}
updates_project:
  - type: component
    name: ${title}
    status: complete
    path: TBD
---

# ${title}

## Task Metadata
- **Task ID**: ${taskId}
- **Status**: pending
- **Created**: ${createdAt}
- **Links to**: CLAUDE.md → ${claudeMdSection.path}

## Objective
${objective || description}

## Requirements
${requirements ? requirements.map(r => `- ${r}`).join('\n') : '- To be defined'}

## Checkpoints
*Checkpoints will be added as work is decomposed*

## Progress Log
- ${createdAt}: Task created and linked to CLAUDE.md section '${claudeMdSection.path}'
`;
  }

  generateCheckpointMd(data) {
    const { checkpointId, title, objective, parentTaskId, parentTaskPath, createdAt } = data;

    return `---;
checkpointId: ${checkpointId}
title: ${title}
status: pending
parentTask: ${parentTaskId}
created: ${createdAt}
validation:
  eslint: pending
  tests: pending
  accessibility: pending
---

# ${title}

## Checkpoint Metadata
- **Checkpoint ID**: ${checkpointId}
- **Status**: pending
- **Parent Task**: ${parentTaskId}
- **Created**: ${createdAt}
- **Links to**: ${parentTaskPath}/task.md

## Objective
${objective}

## Validation Requirements
- [ ] ESLint validation passes
- [ ] Unit tests pass with 100% coverage
- [ ] Accessibility checks pass
- [ ] Integration tests pass
- [ ] Sacred principles compliance verified

## Implementation Plan
*To be defined based on task requirements*

## Self-Healing Actions
If validation fails:
1. Analyze failure reason
2. Apply automated fixes where possible
3. Re-run validation
4. Document any manual intervention needed

## Progress Log
- ${createdAt}: Checkpoint created and linked to parent task ${parentTaskId}
`;
  }
}

export default HierarchyManager;
