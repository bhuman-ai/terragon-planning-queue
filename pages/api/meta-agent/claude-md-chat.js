/**
 * Meta-Agent Chat API for CLAUDE.md Interaction
 * Provides intelligent assistance for understanding and managing CLAUDE.md documents
 */

const Anthropic = require('@anthropic-ai/sdk');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    message,
    claudeMdContent,
    repoInfo,
    userSettings,
    chatHistory = []
  } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const claudeApiKey = process.env.CLAUDE_API_KEY;
  if (!claudeApiKey) {
    return res.status(500).json({
      error: 'Claude API key not configured',
      response: 'Sorry, I need a Claude API key to assist you. Please configure CLAUDE_API_KEY in your environment variables.'
    });
  }

  try {
    const claude = new Anthropic({ apiKey: claudeApiKey });

    // Build context for the meta-agent
    const contextPrompt = buildMetaAgentPrompt(message, claudeMdContent, repoInfo, userSettings, chatHistory);

    const response = await claude.messages.create({
      model: 'claude-opus-4-20250514', // Use best model for meta-agent
      max_tokens: 2000,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: contextPrompt
      }]
    });

    const assistantResponse = response.content[0].text;

    // Parse response for actions and suggestions
    const parsedResponse = parseAssistantResponse(assistantResponse);

    res.status(200).json({
      response: parsedResponse.content,
      suggestions: parsedResponse.suggestions,
      action: parsedResponse.action,
      confidence: parsedResponse.confidence
    });

  } catch (error) {
    console.error('Meta-agent chat error:', error);

    // Provide helpful fallback responses
    const fallbackResponse = generateFallbackResponse(message, claudeMdContent);

    res.status(200).json({
      response: fallbackResponse,
      suggestions: [
        'Show me the tech stack',
        'What are the sacred principles?',
        'How do I update this document?',
        'Check for drift'
      ],
      error: error.message
    });
  }
}

/**
 * Build comprehensive prompt for meta-agent
 */
function buildMetaAgentPrompt(message, claudeMdContent, repoInfo, userSettings, chatHistory) {
  const recentHistory = chatHistory.slice(-6).map(msg =>
    `${msg.role}: ${msg.content}`
  ).join('\n');

  return `You are a Meta-Agent Assistant specializing in CLAUDE.md sacred document management. You help users understand, analyze, and maintain their project's sacred documentation.

CURRENT CLAUDE.MD DOCUMENT:
\`\`\`markdown;
${claudeMdContent.substring(0, 6000)}${claudeMdContent.length > 6000 ? '\n... (truncated)' : ''}
\`\`\`

REPOSITORY CONTEXT:
- Repository: ${repoInfo?.name || 'Unknown'}
- Owner: ${repoInfo?.owner || 'Unknown'}

USER SETTINGS:
${userSettings ? `
- Technical Knowledge: ${userSettings.technicalKnowledge}
- Experience Level: ${userSettings.experience}
- Communication Style: ${userSettings.communicationStyle}
- Questioning Style: ${userSettings.questioningStyle}
` : 'No user settings configured'}

RECENT CHAT HISTORY:
${recentHistory}

USER MESSAGE: '${message}'

INSTRUCTIONS:
You are an expert assistant for CLAUDE.md sacred documents. Your role is to:

1. **Analyze & Explain**: Help users understand their CLAUDE.md content, structure, and principles
2. **Detect Issues**: Identify drift, inconsistencies, or missing information
3. **Suggest Improvements**: Recommend updates, additions, or corrections
4. **Guide Actions**: Help users maintain document integrity and sacred principles
5. **Answer Questions**: Provide specific, actionable answers about the document

RESPONSE GUIDELINES:
- Be concise but thorough
- Reference specific sections of CLAUDE.md when relevant
- Adapt complexity to user's technical knowledge level
- Provide actionable suggestions when appropriate
- Maintain reverence for the sacred document principles
- If suggesting changes, explain why and how they align with sacred principles

RESPONSE FORMAT:
Your response should be conversational and helpful. If you suggest actions, include them naturally in your response.

For actionable suggestions, you can include:
- SUGGEST_UPDATE: if document needs updating
- SUGGEST_BACKUP: if backup should be created
- SUGGEST_REFRESH: if document should be reloaded
- DETECT_DRIFT: if drift analysis is needed

EXAMPLE RESPONSES:
- For 'What's the tech stack?': Analyze the Technology Stack section and provide a clear summary
- For 'Is this document current?': Check for signs of drift and provide analysis
- For 'How do I add a new dependency?': Explain the process and sacred principles involved
- For 'What are the sacred rules?': Extract and explain the absolute rules/principles

Remember: The CLAUDE.md is a living, sacred document that must be treated with respect while being practical and useful.

Now respond to the user's message:`;
}

/**
 * Parse assistant response for actions and suggestions
 */
function parseAssistantResponse(response) {
  const result = {
    content: response,
    suggestions: [],
    action: null,
    confidence: 'medium'
  };

  // Extract action suggestions
  if (response.includes('SUGGEST_UPDATE')) {
    result.action = { type: 'trigger_update' };
    result.suggestions.push('Trigger document update');
  }

  if (response.includes('SUGGEST_BACKUP')) {
    result.action = { type: 'create_backup' };
    result.suggestions.push('Create backup');
  }

  if (response.includes('SUGGEST_REFRESH')) {
    result.action = { type: 'refresh_document' };
    result.suggestions.push('Refresh document');
  }

  // Generate contextual suggestions based on response content
  if (response.toLowerCase().includes('tech stack')) {
    result.suggestions.push('Show me the dependencies');
    result.suggestions.push('Check for new technologies');
  }

  if (response.toLowerCase().includes('sacred') || response.toLowerCase().includes('principle')) {
    result.suggestions.push('List all sacred rules');
    result.suggestions.push('Check for violations');
  }

  if (response.toLowerCase().includes('drift') || response.toLowerCase().includes('current')) {
    result.suggestions.push('Analyze document drift');
    result.suggestions.push('Compare with project state');
  }

  // Add general helpful suggestions
  if (result.suggestions.length < 3) {
    const generalSuggestions = [
      'Explain the project architecture',
      'What needs updating?',
      'Show me recent changes',
      'Check document health';
    ];

    generalSuggestions.forEach(suggestion => {
      if (result.suggestions.length < 4 && !result.suggestions.includes(suggestion)) {
        result.suggestions.push(suggestion);
      }
    });
  }

  // Clean up the response (remove action markers)
  result.content = result.content
    .replace(/SUGGEST_\w+/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  return result;
}

/**
 * Generate fallback response when Claude API fails
 */
function generateFallbackResponse(message, claudeMdContent) {
  const msg = message.toLowerCase();

  if (msg.includes('tech') || msg.includes('stack') || msg.includes('dependencies')) {
    return extractTechStackInfo(claudeMdContent);
  }

  if (msg.includes('sacred') || msg.includes('rule') || msg.includes('principle')) {
    return extractSacredPrinciples(claudeMdContent);
  }

  if (msg.includes('architecture') || msg.includes('structure')) {
    return extractArchitectureInfo(claudeMdContent);
  }

  if (msg.includes('update') || msg.includes('change') || msg.includes('modify')) {
    return 'I can help you update your CLAUDE.md document. The sacred document should only be modified through the calibration process or automatic updates to maintain its integrity. Would you like me to check if any updates are needed?';
  }

  return `I'm currently unable to access my full AI capabilities, but I can still help you with your CLAUDE.md document. Your document appears to be ${claudeMdContent.length} characters long. You can ask me about specific sections, request updates, or get guidance on maintaining the sacred document.`;
}

/**
 * Extract tech stack information from CLAUDE.md
 */
function extractTechStackInfo(content) {
  const techStackMatch = content.match(/### Technology Stack([\s\S]*?)(?=###|$)/i);
  if (techStackMatch) {
    return `Here's your current technology stack:\n\n${techStackMatch[1].trim()}`;
  }

  const techMatch = content.match(/tech.*?stack|dependencies|frameworks/i);
  if (techMatch) {
    return 'I can see references to your tech stack in the document. The technology stack section contains your current frameworks and dependencies.';
  }

  return 'I couldn't find a specific tech stack section. Your CLAUDE.md may need to be updated to include current technologies and dependencies.';
}

/**
 * Extract sacred principles from CLAUDE.md
 */
function extractSacredPrinciples(content) {
  const sacredMatch = content.match(/### ABSOLUTE RULES.*?NEVER VIOLATE([\s\S]*?)(?=###|$)/i);
  if (sacredMatch) {
    return `Here are your sacred principles:\n\n${sacredMatch[1].trim()}`;
  }

  const rulesMatch = content.match(/sacred.*?principles|absolute.*?rules/i);
  if (rulesMatch) {
    return 'Your document contains sacred principles that govern the project. These are the foundational rules that must never be violated.';
  }

  return 'Every CLAUDE.md should have sacred principles. These are the absolute rules that guide all development decisions and cannot be compromised.';
}

/**
 * Extract architecture information from CLAUDE.md
 */
function extractArchitectureInfo(content) {
  const archMatch = content.match(/### Core Architecture|### Architecture|## .*Architecture([\s\S]*?)(?=###|##|$)/i);
  if (archMatch) {
    return `Here's your project architecture:\n\n${archMatch[1].trim()}`;
  }

  const structureMatch = content.match(/project.*?structure|file.*?structure|directory.*?structure/i);
  if (structureMatch) {
    return 'Your document contains project structure information that defines how your codebase is organized.';
  }

  return 'Project architecture defines how your system is structured. This should include your core components, data flow, and organizational patterns.';
}
