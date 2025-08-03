/**
 * Task Decomposition for Meta-Agent
 * Breaks complex tasks into small, manageable micro-tasks
 */

const Anthropic = require('@anthropic-ai/sdk');

class TaskDecomposer {
  constructor(config = {}) {
    this.claudeApiKey = config.claudeApiKey || process.env.CLAUDE_API_KEY;
    this.maxMicroTaskDuration = config.maxDuration || 10; // 10 minutes max per task

    if (this.claudeApiKey) {
      this.claude = new Anthropic({ apiKey: this.claudeApiKey });
    }
  }

  /**
   * Decompose a task into micro-tasks - 100% AI-driven, no templates
   */
  async decompose(taskSpec, requirements = {}, codebaseContext = {}) {
    if (!this.claude) {
      throw new Error('Claude AI is required for task decomposition. Predefined templates are not allowed.');
    }

    try {
      const prompt = this.buildIntelligentDecompositionPrompt(taskSpec, requirements, codebaseContext);

      // Try Opus 4 first, fallback to Sonnet 4
      let modelToUse = 'claude-opus-4-20250514';
      let response;

      try {
        response = await this.claude.messages.create({
          model: modelToUse,
          max_tokens: 4000,
          temperature: 0.1,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });
      } catch (error) {
        if (error.message?.includes('model') || error.status === 400) {
          console.log('🔄 Opus 4 unavailable, falling back to Sonnet 4...');
          modelToUse = 'claude-sonnet-4-20250514';

          try {
            response = await this.claude.messages.create({
              model: modelToUse,
              max_tokens: 4000,
              temperature: 0.1,
              messages: [{
                role: 'user',
                content: prompt
              }]
            });
          } catch (fallbackError) {
            console.log('🔄 Sonnet 4 unavailable, using Sonnet 3.5...');
            modelToUse = 'claude-3-5-sonnet-20241022';
            response = await this.claude.messages.create({
              model: modelToUse,
              max_tokens: 3000,
              temperature: 0.1,
              messages: [{
                role: 'user',
                content: prompt
              }]
            });
          }
        } else {
          throw error;
        }
      }

      console.log(`✅ Using model: ${modelToUse}`);

      const content = response.content[0].text;
      const decomposition = this.parseDecomposition(content);

      if (!decomposition || decomposition.length === 0) {
        throw new Error('Failed to generate valid task decomposition');
      }

      return decomposition;
    } catch (error) {
      console.error('Task decomposition failed:', error);
      throw new Error(`Intelligent task decomposition failed: ${error.message}`);
    }
  }

  /**
   * Build intelligent decomposition prompt with full context analysis
   */
  buildIntelligentDecompositionPrompt(taskSpec, requirements, codebaseContext) {
    const { title, description, research } = taskSpec;

    const prompt = `You are an expert software architect tasked with intelligently decomposing a complex development task into precise, implementable micro-tasks.

CONTEXT ANALYSIS:;
Project: ${codebaseContext.projectType || 'Unknown'}
Tech Stack: ${codebaseContext.techStack?.join(', ') || 'Unknown'}
Existing Features: ${codebaseContext.existingFeatures?.join(', ') || 'None identified'}
Architecture: ${codebaseContext.architecture || 'Unknown'}
Project Structure: ${JSON.stringify(codebaseContext.currentStructure || {})}
Relevant Files: ${codebaseContext.relevantFiles?.slice(0, 10).join(', ') || 'None found'}

TASK TO DECOMPOSE:
Title: ${title}
Description: ${description}

`;

    // Add requirements if gathered
    if (requirements && requirements.questions && requirements.questions.length > 0) {
      prompt += 'USER REQUIREMENTS:\n';
      requirements.questions.forEach((req, idx) => {
        if (req.answer) {
          prompt += `${idx + 1}. ${req.question}: ${req.answer}\n`;
        }
      });
      prompt += '\n';
    }

    // Add research findings if available
    if (research && research.success && research.content) {
      prompt += `RESEARCH FINDINGS:\n${research.content.substring(0, 1000)}...\n\n`;
    }

    prompt += `DECOMPOSITION REQUIREMENTS:
1. Analyze the task in the context of the existing codebase and architecture
2. Each micro-task must take ≤${this.maxMicroTaskDuration} minutes to complete
3. Tasks must be atomic and implementable (no vague descriptions)
4. Consider the existing tech stack and project patterns
5. Include proper error handling and testing tasks
6. Account for integration with existing features
7. Be specific about file locations and implementation details
8. Consider security, performance, and maintainability

INTELLIGENT ANALYSIS REQUIRED:
- What files need to be created/modified based on the existing structure?
- What dependencies or integrations are needed with existing code?
- What are the specific technical challenges for this codebase?
- What testing strategy fits the existing test patterns?
- What deployment/build steps are needed for this project?

FORMAT EACH MICRO-TASK AS:
TASK: [number]. [specific, actionable title with file/component names]
DURATION: [realistic minutes estimate]
DEPENDENCIES: [none or specific task numbers that must complete first]
SUCCESS_CRITERIA: [measurable, testable completion criteria]
TYPE: [setup|implementation|testing|integration|deployment|documentation]
TECHNICAL_DETAILS: [specific files, functions, or components to work with]

GENERATE MICRO-TASKS (be thorough and context-aware):`;

    return prompt;
  }

  /**
   * Parse decomposition response
   */
  parseDecomposition(content) {
    const tasks = [];
    const taskBlocks = content.split(/TASK:/i).filter(block => block.trim());

    for (const block of taskBlocks) {
      const task = this.parseTaskBlock(block);
      if (task) {
        tasks.push(task);
      }
    }

    return this.optimizeTaskOrder(tasks);
  }

  /**
   * Parse individual task block with enhanced fields
   */
  parseTaskBlock(block) {
    const lines = block.trim().split('\n');
    const [titleMatch] = lines.match(/^\s*(\d+)\.\s*(.+)/);

    if (!titleMatch) return null;

    const task = {
      id: parseInt(titleMatch[1]),
      title: titleMatch[2].trim(),
      duration: 10,
      dependencies: [],
      successCriteria: '',
      type: 'implementation',
      technicalDetails: ''
    };

    // Parse other fields
    for (const line of lines.slice(1)) {
      if (line.includes('DURATION:')) {
        const durationMatch = line.match(/DURATION:\s*(\d+)/i);
        if (durationMatch) {
          task.duration = parseInt(durationMatch[1]);
        }
      } else if (line.includes('DEPENDENCIES:')) {
        const deps = line.replace(/DEPENDENCIES:/i, '').trim();
        if (deps.toLowerCase() !== 'none') {
          task.dependencies = deps.match(/\d+/g)?.map(n => parseInt(n)) || [];
        }
      } else if (line.includes('SUCCESS_CRITERIA:')) {
        task.successCriteria = line.replace(/SUCCESS_CRITERIA:/i, '').trim();
      } else if (line.includes('TYPE:')) {
        task.type = line.replace(/TYPE:/i, '').trim().toLowerCase();
      } else if (line.includes('TECHNICAL_DETAILS:')) {
        task.technicalDetails = line.replace(/TECHNICAL_DETAILS:/i, '').trim();
      }
    }

    return task;
  }

  /**
   * Optimize task order based on dependencies
   */
  optimizeTaskOrder(tasks) {
    // Topological sort for dependency ordering
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (taskId) => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        console.warn('Circular dependency detected for task', taskId);
        return;
      }

      visiting.add(taskId);
      const task = tasks.find(t => t.id === taskId);

      if (task) {
        for (const dep of task.dependencies) {
          visit(dep);
        }
        sorted.push(task);
      }

      visiting.delete(taskId);
      visited.add(taskId);
    };

    // Visit all tasks
    for (const task of tasks) {
      visit(task.id);
    }

    // Renumber tasks
    sorted.forEach((task, index) => {
      task.order = index + 1;
    });

    return sorted;
  }


  /**
   * Validate decomposition meets criteria
   */
  validateDecomposition(tasks) {
    const issues = [];

    for (const task of tasks) {
      // Check duration
      if (task.duration > this.maxMicroTaskDuration) {
        issues.push(`Task '${task.title}' exceeds max duration (${task.duration} > ${this.maxMicroTaskDuration})`);
      }

      // Check dependencies exist
      for (const dep of task.dependencies) {
        if (!tasks.find(t => t.id === dep)) {
          issues.push(`Task '${task.title}' has invalid dependency: ${dep}`);
        }
      }

      // Check success criteria
      if (!task.successCriteria) {
        issues.push(`Task '${task.title}' missing success criteria`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get total estimated time
   */
  getTotalTime(tasks) {
    return tasks.reduce((total, task) => total + task.duration, 0);
  }

  /**
   * Get critical path (longest dependency chain)
   */
  getCriticalPath(tasks) {
    const memo = new Map();

    const getPathLength = (taskId) => {
      if (memo.has(taskId)) return memo.get(taskId);

      const task = tasks.find(t => t.id === taskId);
      if (!task) return 0;

      let maxDepPath = 0;
      for (const dep of task.dependencies) {
        maxDepPath = Math.max(maxDepPath, getPathLength(dep));
      }

      const pathLength = task.duration + maxDepPath;
      memo.set(taskId, pathLength);
      return pathLength;
    };

    let criticalPath = 0;
    for (const task of tasks) {
      criticalPath = Math.max(criticalPath, getPathLength(task.id));
    }

    return criticalPath;
  }
}

module.exports = TaskDecomposer;
