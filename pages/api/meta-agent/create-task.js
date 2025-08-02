import MetaAgent from '../../../lib/meta-agent';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      proposalId,
      title, 
      description, 
      requirements = {}, 
      research = null,
      decomposition = null,
      sessionToken,
      githubRepoFullName,
      originalTask
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    // Initialize MetaAgent
    const metaAgent = new MetaAgent({
      claudeApiKey: process.env.CLAUDE_API_KEY,
      perplexityApiKey: process.env.PERPLEXITY_API_KEY,
      enabled: true,
      workingDir: process.cwd()
    });

    // Create task specification
    const taskSpec = {
      title,
      description,
      requirements: Object.entries(requirements).map(([id, answer]) => ({
        id,
        answer,
        question: `Requirement ${id}`
      })),
      research,
      decomposition: decomposition?.microTasks || []
    };

    // Create task with folder structure
    const result = await metaAgent.createTask(taskSpec);

    if (!result) {
      throw new Error('Failed to create task structure');
    }

    // Store task in Vercel KV if available for monitoring
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const { kv } = await import('@vercel/kv');
        const taskData = {
          ...result,
          proposalId,
          status: 'pending',
          createdAt: new Date().toISOString(),
          progress: {
            total: taskSpec.decomposition.length,
            completed: 0,
            current: null
          }
        };
        await kv.set(`task:${result.taskId}`, taskData, { ex: 86400 * 7 }); // 7 days TTL
        await kv.lpush('active-tasks', result.taskId);
      } catch (kvError) {
        console.error('KV storage error:', kvError);
      }
    }

    // Send to Terragon if session token provided
    let terragonResult = null;
    if (sessionToken) {
      try {
        // Build enhanced message for Terragon with complete decomposition
        let terragonMessage = formatDecompositionForTerragon(decomposition || taskSpec.decomposition, title, description);
        terragonMessage += `\n\nMeta-Agent Task ID: ${result.taskId}\nTask Path: ${result.taskPath}`;

        const terragonResponse = await fetch(`${req.headers.origin || process.env.NEXT_PUBLIC_API_URL || ''}/api/actions/terragon`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken,
            message: terragonMessage,
            githubRepoFullName: githubRepoFullName || 'user/project',
            repoBaseBranchName: 'main',
            enrichContext: true
          })
        });

        if (terragonResponse.ok) {
          terragonResult = await terragonResponse.json();
          
          // Update task status in KV
          if (process.env.KV_REST_API_URL) {
            const { kv } = await import('@vercel/kv');
            const taskData = await kv.get(`task:${result.taskId}`);
            if (taskData) {
              taskData.status = 'executing';
              taskData.terragon = {
                taskId: terragonResult.taskId,
                terragonUrl: terragonResult.terragonUrl || `https://www.terragonlabs.com/task/${terragonResult.taskId}`,
                sessionToken
              };
              await kv.set(`task:${result.taskId}`, taskData, { ex: 86400 * 7 });
            }
          }
        }
      } catch (error) {
        console.error('Error sending to Terragon:', error);
      }
    }

    res.status(200).json({
      success: true,
      task: {
        ...result,
        terragon: terragonResult
      }
    });
    // Start task monitoring if enabled
    if (process.env.ENABLE_TASK_MONITOR === 'true') {
      try {
        await fetch(`${req.headers.origin || process.env.NEXT_PUBLIC_API_URL || ''}/api/task-monitor/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: result.taskId })
        });
      } catch (monitorError) {
        console.error('Task monitor start error:', monitorError);
      }
    }

  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create task' 
    });
  }
}

/**
 * Format decomposition into Terragon-friendly prompt
 */
function formatDecompositionForTerragon(decomposition, title, description) {
  let prompt = `# Task: ${title}\n\n${description}\n\n`;
  prompt += `## Implementation Plan\n\n`;
  
  const microTasks = decomposition?.microTasks || decomposition || [];
  prompt += `This task has been decomposed into ${microTasks.length} micro-tasks:\n\n`;

  if (Array.isArray(microTasks)) {
    microTasks.forEach((task, index) => {
      prompt += `### ${index + 1}. ${task.title}\n`;
      prompt += `- Duration: ${task.duration} minutes\n`;
      prompt += `- Type: ${task.type}\n`;
      if (task.dependencies?.length > 0) {
        prompt += `- Dependencies: Tasks ${task.dependencies.join(', ')}\n`;
      }
      prompt += `- Success Criteria: ${task.successCriteria}\n`;
      if (task.technicalDetails) {
        prompt += `- Technical Details: ${task.technicalDetails}\n`;
      }
      prompt += `\n`;
    });
  }

  prompt += `\n## Execution Instructions\n`;
  prompt += `1. Complete each micro-task in order, respecting dependencies\n`;
  prompt += `2. Ensure all success criteria are met before moving to next task\n`;
  prompt += `3. Ask for clarification if any task requirements are unclear\n`;
  prompt += `4. Update progress after each task completion\n`;

  return prompt;
}