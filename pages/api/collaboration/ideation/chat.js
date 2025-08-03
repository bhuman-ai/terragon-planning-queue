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
      message,
      draftContent,
      selectedText,
      aiMode,
      chatHistory
    } = req.body;

    // Get session data
    const session = await kv.get(`collaboration:session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Prepare context for Claude
    const systemPrompt = `You are an AI assistant helping with collaborative document ideation for CLAUDE.md files. Your role is to:

1. Help brainstorm and refine ideas for the sacred document
2. Provide constructive feedback and suggestions
3. Maintain document structure and integrity
4. Support the user's creative process

Current AI Mode: ${aiMode}
- collaborative: Work together on ideas and content
- research: Focus on factual information and best practices
- critique: Provide analytical feedback and improvements

Current draft length: ${draftContent.length} characters
Selected text: ${selectedText ? `"${selectedText}"` : 'None'}

Sacred Document Principles:
- Document-driven development approach
- Maintain consistency with project architecture
- Focus on practical, actionable content
- Preserve user's voice and intentions`;

    const userPrompt = `User message: ${message}

Current draft content:
${draftContent}

Recent chat context:
${chatHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Please provide helpful assistance based on the current AI mode (${aiMode}). If suggesting changes, be specific about what and why.`;

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt
    });

    const assistantResponse = response.content[0].text;

    // Generate suggestions based on the response
    const suggestions = [];
    if (selectedText) {
      suggestions.push(
        'Expand this section',
        'Provide examples',
        'Add implementation details'
      );
    } else {
      suggestions.push(
        'What should I add next?',
        'Review the structure',
        'Suggest improvements'
      );
    }

    // Check for proposed changes
    const proposedChanges = [];
    if (assistantResponse.includes('suggest') || assistantResponse.includes('recommend')) {
      // Extract suggested changes (simplified approach)
      proposedChanges.push({
        type: 'suggestion',
        description: 'AI-suggested improvement',
        confidence: 0.7
      });
    }

    res.status(200).json({
      response: assistantResponse,
      suggestions,
      proposedChanges,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Ideation chat error:', error);
    res.status(500).json({
      error: 'Failed to process ideation chat',
      details: error.message
    });
  }
}
