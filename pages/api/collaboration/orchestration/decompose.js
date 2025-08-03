import Anthropic from '@anthropic-ai/sdk';
import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify agent authentication
    const agentAuth = req.headers['x-agent-auth'] || req.headers['X-Agent-Auth'];
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    const {
      sessionId,
      taskDescription,
      context,
      requirements
    } = req.body;

    // Get session data
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const systemPrompt = `You are an expert task decomposition AI specializing in breaking down complex development tasks into manageable micro-tasks.

REQUIREMENTS:;
- Each step must be completable in under ${requirements.targetDuration || '10 minutes'}
- Maximum ${requirements.maxSteps || 20} steps total
- Include validation steps if requested: ${requirements.includeValidation}
- Generate dependencies between steps: ${requirements.generateDependencies}

SACRED PRINCIPLES (from CLAUDE.md):
- No simulations or mocking - everything must be real
- Quality over speed always
- Document-driven development approach
- AI-driven decomposition (no templates)
- Each step must have clear deliverables

RESPONSE FORMAT:
Return a JSON object with:
{
  'steps': [
    {
      'id': 'step_001',
      'title': 'Clear action title',
      'description': 'Detailed description with specific actions',
      'estimatedDuration': '5 minutes',
      'assignedAgent': 'suggested-agent-type',
      'dependencies': ['step_id1', 'step_id2'],
      'deliverables': ['specific output 1', 'specific output 2'],
      'validationCriteria': ['how to verify completion'],
      'priority': 'high|medium|low'
    }
  ],
  'dependencies': [['step_001', ['prerequisite_step']]],
  'timeEstimates': {'step_001': 300000},
  'recommendedAgents': ['frontend-developer', 'backend-architect']
}`;

    const userPrompt = `Task to decompose: ${taskDescription}

Context from ideation phase:
${context}

Session context:
- User settings: ${JSON.stringify(session.userSettings)}
- GitHub config: ${JSON.stringify(session.githubConfig)}

Please decompose this task following the sacred principles. Focus on:
1. Real, actionable steps (no simulation)
2. Clear dependencies and sequencing
3. Specific deliverables for each step
4. Appropriate agent assignments
5. Validation and quality checkpoints

Be extremely specific about what needs to be built, tested, and delivered.`;

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt
    });

    let decompositionResult;
    try {
      // Try to parse JSON from response
      const responseText = response.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        decompositionResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback: create structured response from text
      decompositionResult = {
        steps: [{
          id: 'step_001',
          title: 'Manual decomposition required',
          description: response.content[0].text,
          estimatedDuration: '10 minutes',
          assignedAgent: 'meta-agent',
          dependencies: [],
          deliverables: ['Structured task breakdown'],
          validationCriteria: ['Task is properly decomposed'],
          priority: 'high'
        }],
        dependencies: [],
        timeEstimates: { 'step_001': 600000 },
        recommendedAgents: ['meta-agent']
      };
    }

    // Validate and enhance the decomposition
    if (!decompositionResult.steps || !Array.isArray(decompositionResult.steps)) {
      throw new Error('Invalid step structure returned');
    }

    // Add IDs if missing
    decompositionResult.steps.forEach((step, index) => {
      if (!step.id) {
        step.id = `step_${String(index + 1).padStart(3, '0')}`;
      }
      if (!step.estimatedDuration) {
        step.estimatedDuration = '8 minutes';
      }
      if (!step.assignedAgent) {
        step.assignedAgent = 'general-agent';
      }
      if (!step.dependencies) {
        step.dependencies = [];
      }
      if (!step.deliverables) {
        step.deliverables = ['Completion confirmation'];
      }
    });

    // Convert dependencies to Map format
    const dependencyMap = new Map();
    if (decompositionResult.dependencies) {
      decompositionResult.dependencies.forEach(([stepId, deps]) => {
        dependencyMap.set(stepId, deps);
      });
    }

    res.status(200).json({
      steps: decompositionResult.steps,
      dependencies: Array.from(dependencyMap.entries()),
      timeEstimates: decompositionResult.timeEstimates || {},
      recommendedAgents: decompositionResult.recommendedAgents || [],
      metadata: {
        totalSteps: decompositionResult.steps.length,
        estimatedTotalTime: decompositionResult.steps.reduce((total, step) => {
          const minutes = parseInt(step.estimatedDuration) || 8;
          return total + (minutes * 60000);
        }, 0),
        generatedAt: new Date().toISOString(),
        taskDescription
      }
    });

  } catch (error) {
    console.error('Task decomposition error:', error);
    res.status(500).json({
      error: 'Failed to decompose task',
      details: error.message
    });
  }
}
