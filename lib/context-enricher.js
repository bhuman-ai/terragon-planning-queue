// Context enricher for Terragon messages
import fs from 'fs';
import path from 'path';

export function enrichMessageWithContext(originalMessage, options = {}) {
  const {
    workingDirectory = process.cwd(),
    sessionData = {},
    projectInfo = {}
  } = options;

  // Detect intent from message
  const actionKeywords = ['implement', 'create', 'build', 'fix', 'add', 'update', 'refactor'];
  const planningKeywords = ['plan', 'design', 'architect', 'structure'];
  const infoKeywords = ['what', 'how', 'why', 'explain', 'tell me', 'describe'];

  const lowerMessage = originalMessage.toLowerCase();
  const isAction = actionKeywords.some(keyword => lowerMessage.includes(keyword));
  const isPlanning = planningKeywords.some(keyword => lowerMessage.includes(keyword));
  const isInfo = infoKeywords.some(keyword => lowerMessage.startsWith(keyword));

  // Build context
  const context = {
    intent: isAction ? 'action' : isPlanning ? 'planning' : isInfo ? 'information' : 'general',
    environment: {
      workingDirectory,
      platform: process.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    },
    projectStructure: {
      tasksDirectory: '/tasks/',
      taskFormat: 'task-XXX-{name}/',
      documentationFile: 'task.md'
    },
    workflow: {
      commands: ['/start-task', '/complete-task', '/test-task'],
      currentTasks: getExistingTasks(workingDirectory),
      lastTaskNumber: getLastTaskNumber(workingDirectory)
    }
  };

  // Create enriched message
  let enrichedMessage = '';

  if (isAction || isPlanning) {
    enrichedMessage = `
[SYSTEM CONTEXT]
Working Directory: ${workingDirectory}
Task Management: Active (use /tasks/task-XXX-{name}/ structure)
Next Task Number: ${String(context.workflow.lastTaskNumber + 1).padStart(3, '0')}
Intent Detected: ${context.intent}

[WORKFLOW INSTRUCTIONS]
1. If implementing, create task folder: /tasks/task-${String(context.workflow.lastTaskNumber + 1).padStart(3, '0')}-{descriptive-name}/
2. Document all work in task.md with timestamps
3. Follow established patterns from existing tasks
4. Use semantic task names (e.g., user-auth, api-integration)

[USER REQUEST]
${originalMessage}
`;
  } else {
    // For info requests, lighter context
    enrichedMessage = `
[CONTEXT]
Working in: ${path.basename(workingDirectory)}
Available task commands: ${context.workflow.commands.join(', ')}

[USER REQUEST]
${originalMessage}
`;
  }

  return {
    enrichedMessage,
    metadata: context
  };
}

function getExistingTasks(workingDir) {
  const tasksDir = path.join(workingDir, 'tasks');
  if (!fs.existsSync(tasksDir)) return [];

  try {
    return fs.readdirSync(tasksDir)
      .filter(dir => dir.startsWith('task-'))
      .map(dir => {
        const match = dir.match(/task-(\d+)-(.+)/);
        return match ? { number: parseInt(match[1]), name: match[2], fullName: dir } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.number - b.number);
  } catch (error) {
    return [];
  }
}

function getLastTaskNumber(workingDir) {
  const tasks = getExistingTasks(workingDir);
  return tasks.length > 0 ? Math.max(...tasks.map(t => t.number)) : 0;
}

export function createTaskStructure(taskNumber, taskName, workingDir) {
  const paddedNumber = String(taskNumber).padStart(3, '0');
  const taskDirName = `task-${paddedNumber}-${taskName}`;
  const taskPath = path.join(workingDir, 'tasks', taskDirName);

  // Create directories
  fs.mkdirSync(taskPath, { recursive: true });

  // Create initial task.md
  const taskMd = `# Task ${paddedNumber}: ${taskName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

## Status: In Progress
Created: ${new Date().toISOString()}

## Objective
[Defined by Terragon agent]

## Implementation Plan
[To be filled by agent]

## Progress Log
- ${new Date().toISOString()}: Task created
`;

  fs.writeFileSync(path.join(taskPath, 'task.md'), taskMd);

  return {
    taskPath,
    taskDirName,
    taskNumber: paddedNumber
  };
}
