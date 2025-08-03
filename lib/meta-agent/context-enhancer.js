/**
 * Context Enhancement for MetaAgent
 * Builds rich context from project files, tasks, and documentation
 */

const fs = require('fs').promises;
const path = require('path');

class ContextEnhancer {
  constructor(config = {}) {
    this.workingDir = config.workingDir || process.cwd();
    this.maxContextSize = config.maxContextSize || 50000; // tokens
  }

  /**
   * Enhance message with full project context
   */
  async enhance(message, classification, options = {}) {
    const context = await this.gatherContext(classification);

    // Based on classification, build appropriate enhanced message
    switch (classification.type) {
      case 'ACTION_REQUEST':
        return this.enhanceActionRequest(message, context);

      case 'INFO_REQUEST':
        return this.enhanceInfoRequest(message, context);

      case 'PLANNING_REQUEST':
        return this.enhancePlanningRequest(message, context);

      case 'STATUS_CHECK':
        return this.enhanceStatusCheck(message, context);

      default:
        return { message, context: context.summary };
    }
  }

  /**
   * Gather all relevant context
   */
  async gatherContext(classification) {
    const context = {
      projectInfo: await this.getProjectInfo(),
      taskInfo: await this.getTaskInfo(),
      relevantFiles: [],
      summary: ''
    };

    // Add classification-specific context
    if (classification.type === 'ACTION_REQUEST') {
      context.taskStructure = await this.getTaskStructureInfo();
      context.recentTasks = await this.getRecentTasks(5);
    }

    // Build summary
    context.summary = this.buildContextSummary(context);

    return context;
  }

  /**
   * Get project information from CLAUDE.md and other sources
   */
  async getProjectInfo() {
    const info = {
      hasClaudeMd: false,
      claudeMdContent: null,
      projectStructure: null,
      techStack: []
    };

    try {
      // Try to read CLAUDE.md
      const claudeMdPath = path.join(this.workingDir, 'CLAUDE.md');
      const claudeMdContent = await fs.readFile(claudeMdPath, 'utf-8');
      info.hasClaudeMd = true;
      info.claudeMdContent = claudeMdContent;

      // Extract key information
      info.techStack = this.extractTechStack(claudeMdContent);
    } catch (error) {
      // CLAUDE.md not found, that's ok
    }

    // Detect project type from package.json
    try {
      const packageJsonPath = path.join(this.workingDir, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Add detected technologies
      if (packageJson.dependencies) {
        if (packageJson.dependencies.next) info.techStack.push('Next.js');
        if (packageJson.dependencies.react) info.techStack.push('React');
        if (packageJson.dependencies.express) info.techStack.push('Express');
      }
    } catch (error) {
      // No package.json, that's ok
    }

    return info;
  }

  /**
   * Get task folder information
   */
  async getTaskInfo() {
    const taskInfo = {
      tasksExist: false,
      taskCount: 0,
      activeTasks: [],
      lastTaskNumber: 0
    };

    try {
      const tasksDir = path.join(this.workingDir, 'tasks');
      const entries = await fs.readdir(tasksDir);

      const taskFolders = entries.filter(entry => entry.startsWith('task-'));
      taskInfo.tasksExist = taskFolders.length > 0;
      taskInfo.taskCount = taskFolders.length;

      // Parse task numbers and names
      for (const folder of taskFolders) {
        const match = folder.match(/task-(\d+)-(.+)/);
        if (match) {
          const taskNum = parseInt(match[1]);
          taskInfo.activeTasks.push({
            number: taskNum,
            name: match[2],
            folder: folder
          });
          taskInfo.lastTaskNumber = Math.max(taskInfo.lastTaskNumber, taskNum);
        }
      }

      // Sort by task number
      taskInfo.activeTasks.sort((a, b) => a.number - b.number);

    } catch (error) {
      // No tasks directory, that's ok
    }

    return taskInfo;
  }

  /**
   * Get recent tasks with their status
   */
  async getRecentTasks(limit = 5) {
    const taskInfo = await this.getTaskInfo();
    const recentTasks = [];

    // Get the most recent tasks
    const tasksToCheck = taskInfo.activeTasks.slice(-limit).reverse();

    for (const task of tasksToCheck) {
      try {
        const taskMdPath = path.join(this.workingDir, 'tasks', task.folder, 'task.md');
        const content = await fs.readFile(taskMdPath, 'utf-8');

        // Extract status
        const statusMatch = content.match(/## Status:\s*(.+)/);
        const status = statusMatch ? statusMatch[1].trim() : 'Unknown';

        recentTasks.push({
          ...task,
          status,
          summary: content.substring(0, 200)
        });
      } catch (error) {
        // Can't read task.md, skip
      }
    }

    return recentTasks;
  }

  /**
   * Get task structure information
   */
  async getTaskStructureInfo() {
    return {
      format: 'task-XXX-{descriptive-name}',
      structure: {
        'task.md': 'Main task documentation',
        'spec.md': 'Detailed specifications',
        'context/': 'Saved context snapshots',
        'artifacts/': 'Generated code and outputs'
      },
      nextTaskNumber: (await this.getTaskInfo()).lastTaskNumber + 1
    };
  }

  /**
   * Enhance action requests with task context
   */
  enhanceActionRequest(message, context) {
    const { taskInfo, projectInfo } = context;

    let enhanced = message;

    // Add context about task structure
    if (taskInfo.tasksExist) {
      enhanced = `[CONTEXT: Project has ${taskInfo.taskCount} existing tasks. Last task: #${taskInfo.lastTaskNumber}]\n\n${enhanced}`;

      // If implementing something, suggest task creation
      const nextNum = String(taskInfo.lastTaskNumber + 1).padStart(3, '0');
      enhanced += `\n\n[TASK STRUCTURE: If implementing, consider creating /tasks/task-${nextNum}-{name}/]`;
    }

    // Add tech stack context
    if (projectInfo.techStack.length > 0) {
      enhanced += `\n[TECH STACK: ${projectInfo.techStack.join(', ')}]`;
    }

    return {
      message: enhanced,
      metadata: {
        hasExistingTasks: taskInfo.tasksExist,
        nextTaskNumber: taskInfo.lastTaskNumber + 1,
        techStack: projectInfo.techStack
      }
    };
  }

  /**
   * Enhance info requests with relevant documentation
   */
  enhanceInfoRequest(message, context) {
    // For info requests, we don't modify much
    // Just add a note if there"s relevant documentation

    let enhanced = message;

    if (context.projectInfo.hasClaudeMd) {
      enhanced += '\n\n[Note: Project has CLAUDE.md with detailed documentation]';
    }

    return {
      message: enhanced,
      metadata: {
        hasDocumentation: context.projectInfo.hasClaudeMd
      }
    };
  }

  /**
   * Enhance planning requests
   */
  enhancePlanningRequest(message, context) {
    let enhanced = message;

    // Add context about recent tasks for planning
    if (context.recentTasks && context.recentTasks.length > 0) {
      enhanced += '\n\n[RECENT TASKS:';
      for (const task of context.recentTasks) {
        enhanced += `\n- Task ${task.number} (${task.name}): ${task.status}`;
      }
      enhanced += ']';
    }

    return {
      message: enhanced,
      metadata: {
        recentTaskCount: context.recentTasks ? context.recentTasks.length : 0
      }
    };
  }

  /**
   * Enhance status checks with task information
   */
  async enhanceStatusCheck(message, context) {
    const taskInfo = await this.getTaskInfo();
    const enhanced = message;

    // Add summary of active tasks
    if (taskInfo.activeTasks.length > 0) {
      enhanced += '\n\n[ACTIVE TASKS SUMMARY:';

      // Get status for each active task
      for (const task of taskInfo.activeTasks.slice(-5)) { // Last 5 tasks
        try {
          const taskMdPath = path.join(this.workingDir, 'tasks', task.folder, 'task.md');
          const content = await fs.readFile(taskMdPath, 'utf-8');
          const statusMatch = content.match(/## Status:\s*(.+)/);
          const status = statusMatch ? statusMatch[1].trim() : 'Unknown';

          enhanced += `\n- Task ${task.number} (${task.name}): ${status}`;
        } catch (error) {
          enhanced += `\n- Task ${task.number} (${task.name}): [Status unknown]`;
        }
      }

      enhanced += ']';
    }

    return {
      message: enhanced,
      metadata: {
        totalTasks: taskInfo.taskCount,
        activeTasks: taskInfo.activeTasks.length
      }
    };
  }

  /**
   * Extract tech stack from CLAUDE.md
   */
  extractTechStack(content) {
    const techStack = [];

    // Common patterns for tech stack mentions
    const patterns = [
      /tech(?:nology)?\s*stack\s*:?\s*([^\n]+)/i,
      /built with\s*:?\s*([^\n]+)/i,
      /using\s*:?\s*([^\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        // Extract tech names
        const [techs] = match.slice(1, 1 + 1).split(/[,]/).map(t => t.trim());
        techStack.push(...techs);
      }
    }

    // Also look for specific tech mentions
    if (content.includes('Next.js')) techStack.push('Next.js');
    if (content.includes('React')) techStack.push('React');
    if (content.includes('TypeScript')) techStack.push('TypeScript');
    if (content.includes('PostgreSQL')) techStack.push('PostgreSQL');

    // Remove duplicates
    return [...new Set(techStack)];
  }

  /**
   * Build a summary of the context
   */
  buildContextSummary(context) {
    const parts = [];

    if (context.projectInfo.techStack.length > 0) {
      parts.push(`Tech: ${context.projectInfo.techStack.join(', ')}`);
    }

    if (context.taskInfo.tasksExist) {
      parts.push(`${context.taskInfo.taskCount} tasks`);
    }

    return parts.join(' | ');
  }
}

module.exports = ContextEnhancer;
