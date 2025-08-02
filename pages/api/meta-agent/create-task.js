import MetaAgent from '../../../lib/meta-agent';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      title, 
      description, 
      requirements = {}, 
      research = null,
      decomposition = null,
      sessionToken 
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

    // Send to Terragon if session token provided
    let terragonResult = null;
    if (sessionToken) {
      try {
        // Build enhanced message for Terragon
        let terragonMessage = `[META-AGENT TASK CREATED]
Task: ${title}
Description: ${description}

Task ID: ${result.taskId}
Task Path: ${result.taskPath}

Requirements Gathered:
${Object.entries(requirements).map(([id, answer]) => `- ${id}: ${answer}`).join('\n')}

Decomposition into ${taskSpec.decomposition.length} micro-tasks:
${taskSpec.decomposition.map((task, idx) => `${idx + 1}. ${task.title} (${task.duration}min)`).join('\n')}

Please review the task structure at ${result.taskPath} and provide implementation guidance.`;

        const terragonResponse = await fetch(`${req.headers.origin}/api/actions/terragon`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken,
            message: terragonMessage,
            githubRepoFullName: req.body.githubRepoFullName || 'user/project',
            repoBaseBranchName: 'main',
            enrichContext: true
          })
        });

        if (terragonResponse.ok) {
          terragonResult = await terragonResponse.json();
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
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create task' 
    });
  }
}