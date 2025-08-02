/**
 * MetaAgent API endpoint - processes messages before sending to Terragon
 * This is completely optional and only runs when explicitly enabled
 */

const MetaAgent = require('../../../lib/meta-agent/index.js');

// Initialize MetaAgent with API keys from environment
const metaAgent = new MetaAgent({
  claudeApiKey: process.env.CLAUDE_API_KEY,
  perplexityApiKey: process.env.PERPLEXITY_API_KEY,
  enabled: true, // Always enabled for this endpoint
  workingDir: process.cwd()
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, message, context = {}, query, taskSpec, requirements } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Missing action parameter' });
    }

    let result;

    switch (action) {
      case 'classify':
        // Just classify the message type
        if (!message) {
          return res.status(400).json({ error: 'Message is required for classify action' });
        }
        const classification = await metaAgent.requestClassifier.classify(message);
        result = { classification };
        break;

      case 'requirements':
        // Gather requirements for the message (DEPRECATED - use pre-research)
        if (!message) {
          return res.status(400).json({ error: 'Message is required for requirements action' });
        }
        result = await metaAgent.gatherRequirements(message, context);
        break;

      case 'pre-research-requirements':
        // Phase 1: Generate pre-research questions
        if (!message) {
          return res.status(400).json({ error: 'Message is required for pre-research action' });
        }
        result = await metaAgent.requirementsGatherer.generatePreResearchQuestions(message, context);
        break;

      case 'post-research-requirements':
        // Phase 2: Generate post-research questions with full context
        if (!message || !req.body.preResearchAnswers) {
          return res.status(400).json({ error: 'Message and preResearchAnswers are required for post-research action' });
        }
        result = await metaAgent.requirementsGatherer.generatePostResearchQuestions(
          message, 
          req.body.preResearchAnswers, 
          context
        );
        break;

      case 'research':
        // Research a specific topic
        const researchQuery = query || message;
        if (!researchQuery) {
          return res.status(400).json({ error: 'Query or message is required for research action' });
        }
        result = await metaAgent.research(researchQuery, context);
        break;

      case 'process':
        // Full processing (classification + context + enhancement)
        if (!message) {
          return res.status(400).json({ error: 'Message is required for process action' });
        }
        result = await metaAgent.process(message, context);
        break;

      case 'enhance':
        // Just enhance with context
        if (!message) {
          return res.status(400).json({ error: 'Message is required for enhance action' });
        }
        const classificationForEnhance = await metaAgent.requestClassifier.classify(message);
        const contextForEnhance = await metaAgent.contextEnhancer.gatherContext(classificationForEnhance);
        const enhanced = await metaAgent.contextEnhancer.enhance(message, classificationForEnhance);
        result = {
          enhanced: enhanced.message,
          metadata: enhanced.metadata,
          classification: classificationForEnhance,
          context: contextForEnhance.summary
        };
        break;

      case 'decompose':
        // Decompose a task into micro-tasks
        if (!taskSpec) {
          return res.status(400).json({ error: 'taskSpec is required for decompose action' });
        }
        result = await metaAgent.decomposeTask(taskSpec, requirements || {});
        break;

      case 'project-interview':
        // Generate dynamic project interview questions
        const { phase, existingAnswers } = req.body;
        
        // Use requirements gatherer to generate intelligent questions
        const projectContext = phase === 'initial' 
          ? 'User is starting a new project. Ask intelligent questions to understand their project goals, technical requirements, and constraints.'
          : 'User has provided initial answers. Ask follow-up questions to get more specific technical details.';
          
        const projectQuestions = await metaAgent.requirementsGatherer.generatePreResearchQuestions(
          projectContext,
          { phase, existingAnswers }
        );
        
        result = projectQuestions;
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.status(200).json({
      success: true,
      action,
      result
    });

  } catch (error) {
    console.error('MetaAgent API error:', error);
    res.status(500).json({
      success: false,
      error: 'MetaAgent processing failed',
      details: error.message
    });
  }
}