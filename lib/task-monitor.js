/**
 * Task Monitor - Autonomous execution when user is offline
 * Polls active tasks and continues execution based on approved proposals
 */

const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class TaskMonitor {
  constructor(config = {}) {
    this.claudeApiKey = config.claudeApiKey || process.env.CLAUDE_API_KEY;
    this.perplexityApiKey = config.perplexityApiKey || process.env.PERPLEXITY_API_KEY;
    this.terragonEndpoint = config.terragonEndpoint || 'https://terragon.ai/api/v1/sessions';
    this.notificationWebhook = config.notificationWebhook;
    this.tasksDir = path.join(process.cwd(), 'data', 'active-tasks');
    
    if (this.claudeApiKey) {
      this.claude = new Anthropic({ apiKey: this.claudeApiKey });
    }
    
    // Ensure tasks directory exists
    this.ensureTasksDirectory();
  }

  async ensureTasksDirectory() {
    try {
      await fs.mkdir(this.tasksDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Main processing loop - called by Vercel cron job
   */
  async processActiveTasks() {
    const stats = {
      processed: 0,
      continued: 0,
      paused: 0,
      completed: 0,
      failed: 0
    };

    try {
      const activeTasks = await this.getActiveTasks();
      console.log(`📋 Found ${activeTasks.length} active tasks to process`);

      for (const task of activeTasks) {
        stats.processed++;
        
        try {
          const result = await this.processTask(task);
          
          switch (result.action) {
            case 'continued':
              stats.continued++;
              break;
            case 'paused':
              stats.paused++;
              await this.notifyUser(task, result.reason);
              break;
            case 'completed':
              stats.completed++;
              await this.markTaskCompleted(task);
              break;
            case 'failed':
              stats.failed++;
              await this.notifyUser(task, `Task failed: ${result.reason}`);
              break;
          }
        } catch (error) {
          console.error(`❌ Error processing task ${task.id}:`, error);
          stats.failed++;
        }
      }
    } catch (error) {
      console.error('❌ Error in processActiveTasks:', error);
    }

    return stats;
  }

  /**
   * Get all active tasks from storage
   */
  async getActiveTasks() {
    try {
      const files = await fs.readdir(this.tasksDir);
      const tasks = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const taskPath = path.join(this.tasksDir, file);
          const taskData = await fs.readFile(taskPath, 'utf-8');
          const task = JSON.parse(taskData);
          
          // Only process tasks that are in 'executing' state and waiting for Terragon response
          if (task.status === 'executing' && task.waitingForResponse) {
            tasks.push(task);
          }
        }
      }

      return tasks;
    } catch (error) {
      console.error('Error reading active tasks:', error);
      return [];
    }
  }

  /**
   * Process a single task
   */
  async processTask(task) {
    console.log(`🔄 Processing task: ${task.id} - ${task.title}`);

    try {
      // Check if Terragon has responded
      const terragonUpdate = await this.checkTerragonResponse(task);
      
      if (!terragonUpdate.hasResponse) {
        console.log(`⏳ Task ${task.id} still waiting for Terragon response`);
        return { action: 'waiting' };
      }

      // Analyze the response and decide next action
      const analysis = await this.analyzeTerragonResponse(task, terragonUpdate.response);
      
      if (analysis.needsUserInput) {
        console.log(`⏸️ Task ${task.id} needs user input: ${analysis.question}`);
        await this.pauseTask(task, analysis.question);
        return { action: 'paused', reason: analysis.question };
      }

      if (analysis.canContinue) {
        console.log(`▶️ Task ${task.id} can continue autonomously`);
        await this.continueTask(task, analysis.nextAction);
        return { action: 'continued' };
      }

      if (analysis.isComplete) {
        console.log(`✅ Task ${task.id} completed successfully`);
        return { action: 'completed' };
      }

      // Default to pausing if uncertain
      await this.pauseTask(task, 'Uncertain how to proceed - needs user review');
      return { action: 'paused', reason: 'Uncertain how to proceed' };

    } catch (error) {
      console.error(`❌ Error processing task ${task.id}:`, error);
      return { action: 'failed', reason: error.message };
    }
  }

  /**
   * Check if Terragon has responded to the task
   */
  async checkTerragonResponse(task) {
    try {
      // Poll Terragon endpoint for the session
      const response = await axios.get(`${this.terragonEndpoint}/${task.terragonSessionId}`, {
        headers: {
          'Authorization': `Bearer ${task.terragonToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Check if there are new messages since last check
      const messages = response.data.messages || [];
      const lastProcessedIndex = task.lastProcessedMessageIndex || -1;
      
      if (messages.length > lastProcessedIndex + 1) {
        const newMessages = messages.slice(lastProcessedIndex + 1);
        return {
          hasResponse: true,
          response: newMessages,
          allMessages: messages
        };
      }

      return { hasResponse: false };
    } catch (error) {
      console.error(`Error checking Terragon response for task ${task.id}:`, error);
      return { hasResponse: false, error: error.message };
    }
  }

  /**
   * Analyze Terragon response using Claude to decide next action
   */
  async analyzeTerragonResponse(task, newMessages) {
    if (!this.claude) {
      return { needsUserInput: true, question: 'Claude API not available for analysis' };
    }

    const prompt = `You are analyzing a Terragon response for an autonomous task execution system.

TASK CONTEXT:
- Task: ${task.title}
- Description: ${task.description}
- Approved Proposal: ${JSON.stringify(task.approvedProposal, null, 2)}
- Current Step: ${task.currentStep || 'Unknown'}

NEW TERRAGON MESSAGES:
${newMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

TASK HISTORY:
${task.conversationHistory ? task.conversationHistory.slice(-5).map(h => `${h.role}: ${h.content}`).join('\n') : 'No history'}

ANALYSIS REQUIRED:
Based on the approved proposal and current execution context, determine if:

1. The task can continue autonomously (you can infer the next logical step)
2. User input is genuinely needed (ambiguous situation, requires human decision)
3. The task appears to be completed successfully
4. There's an error that needs human intervention

Return a JSON object:
{
  "canContinue": boolean,
  "needsUserInput": boolean,
  "isComplete": boolean,
  "nextAction": "string describing next step if canContinue=true",
  "question": "specific question for user if needsUserInput=true",
  "reasoning": "brief explanation of the decision"
}

AUTONOMOUS DECISION CRITERIA:
- Continue if: Response follows expected flow, next step is clear from proposal
- Pause for user if: Unexpected error, requires business decision, ambiguous technical choice
- Complete if: All proposal steps finished, success indicators present`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log(`🧠 Task analysis for ${task.id}:`, analysis.reasoning);
        return analysis;
      }
    } catch (error) {
      console.error('Claude analysis failed:', error);
    }

    // Fallback to conservative approach
    return {
      needsUserInput: true,
      question: 'Unable to analyze response automatically - please review'
    };
  }

  /**
   * Continue task execution autonomously
   */
  async continueTask(task, nextAction) {
    try {
      // Send next action to Terragon
      const response = await axios.post(`${this.terragonEndpoint}/${task.terragonSessionId}/messages`, {
        message: nextAction,
        context: {
          autonomous: true,
          step: (task.currentStep || 0) + 1
        }
      }, {
        headers: {
          'Authorization': `Bearer ${task.terragonToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Update task state
      task.currentStep = (task.currentStep || 0) + 1;
      task.lastProcessedMessageIndex = (task.lastProcessedMessageIndex || -1) + 1;
      task.conversationHistory = task.conversationHistory || [];
      task.conversationHistory.push({
        role: 'assistant',
        content: nextAction,
        timestamp: new Date().toISOString(),
        autonomous: true
      });

      await this.saveTask(task);
      console.log(`✅ Task ${task.id} continued with: ${nextAction}`);
    } catch (error) {
      console.error(`❌ Failed to continue task ${task.id}:`, error);
      throw error;
    }
  }

  /**
   * Pause task and wait for user input
   */
  async pauseTask(task, question) {
    task.status = 'paused';
    task.pauseReason = question;
    task.pausedAt = new Date().toISOString();
    
    await this.saveTask(task);
    console.log(`⏸️ Task ${task.id} paused: ${question}`);
  }

  /**
   * Mark task as completed
   */
  async markTaskCompleted(task) {
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    
    await this.saveTask(task);
    
    // Optionally move to completed tasks directory
    const completedDir = path.join(process.cwd(), 'data', 'completed-tasks');
    await fs.mkdir(completedDir, { recursive: true });
    
    const completedPath = path.join(completedDir, `${task.id}.json`);
    await fs.writeFile(completedPath, JSON.stringify(task, null, 2));
    
    // Remove from active tasks
    const activePath = path.join(this.tasksDir, `${task.id}.json`);
    await fs.unlink(activePath);
    
    console.log(`✅ Task ${task.id} marked as completed`);
  }

  /**
   * Save task to storage
   */
  async saveTask(task) {
    const taskPath = path.join(this.tasksDir, `${task.id}.json`);
    await fs.writeFile(taskPath, JSON.stringify(task, null, 2));
  }

  /**
   * Notify user when input is needed via Discord Bot
   */
  async notifyUser(task, message) {
    console.log(`🤖 Sending Discord Bot question for task ${task.id}: ${message}`);
    
    try {
      // Use the Discord Bot API to ask a question
      const baseUrl = process.env.VERCEL_URL || 'http://localhost:3000';
      const botQuestionUrl = `${baseUrl}/api/discord-bot/ask-question`;
      
      const response = await axios.post(botQuestionUrl, {
        taskId: task.id,
        taskTitle: task.title,
        question: message,
        context: JSON.stringify({
          currentStep: task.currentStep,
          approvedProposal: task.approvedProposal?.summary || 'No proposal available',
          lastTerragonResponse: task.conversationHistory?.slice(-1)[0]?.content || 'No previous response'
        }),
        urgency: task.urgency || 'normal'
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Discord Bot question sent successfully`);
      
      // Store that we're waiting for a Discord response
      task.waitingForDiscordResponse = true;
      task.discordMessageId = response.data.messageId;
      await this.saveTask(task);
      
    } catch (error) {
      console.error('Failed to send Discord Bot question:', error.message);
      
      // Fallback to basic logging
      console.log(`🤖 URGENT: Task ${task.id} needs user input: ${message}`);
    }
  }
}

module.exports = TaskMonitor;