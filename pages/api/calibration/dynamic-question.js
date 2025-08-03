/**
 * Dynamic Calibration API - Generate next question based on conversation history
 */

const Anthropic = require('@anthropic-ai/sdk');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      repo, 
      conversationHistory = [], 
      scanResults = {},
      questionCount = 0 
    } = req.body;

    if (!process.env.CLAUDE_API_KEY) {
      return res.status(500).json({ error: 'Claude API key not configured' });
    }

    const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

    // Build context from scan results and conversation history
    const context = buildCalibrationContext(scanResults, conversationHistory, questionCount);
    
    // Generate the next intelligent question
    const prompt = buildDynamicQuestionPrompt(repo, context, conversationHistory, questionCount);

    const response = await claude.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0].text;
    
    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse question response');
    }

    const questionData = JSON.parse(jsonMatch[0]);

    // Add metadata
    questionData.questionNumber = questionCount + 1;
    questionData.canGenerateClaudeMd = questionCount >= 9; // After 10 questions (0-indexed)
    questionData.timestamp = new Date().toISOString();

    res.status(200).json(questionData);

  } catch (error) {
    console.error('Dynamic question generation error:', error);
    res.status(500).json({
      error: 'Failed to generate question',
      details: error.message
    });
  }
}

function buildCalibrationContext(scanResults, conversationHistory, questionCount) {
  const context = {
    fileCount: scanResults.fileCount || 0,
    techStack: scanResults.detectedTechStack || [],
    projectName: scanResults.projectName || 'Unknown',
    phase: scanResults.suggestedPhase || 'development',
    hasClaudeMd: scanResults.hasExistingClaudeMd || false
  };

  // Extract insights from conversation history
  context.answeredTopics = [];
  context.userPreferences = {};
  context.projectInsights = {};

  conversationHistory.forEach(exchange => {
    if (exchange.question && exchange.answer) {
      context.answeredTopics.push(exchange.question.category || 'general');
      
      // Extract user preferences
      if (exchange.question.category === 'preferences') {
        context.userPreferences[exchange.question.topic] = exchange.answer;
      }
      
      // Extract project insights
      if (exchange.question.category === 'architecture' || exchange.question.category === 'business') {
        context.projectInsights[exchange.question.topic] = exchange.answer;
      }
    }
  });

  return context;
}

function buildDynamicQuestionPrompt(repo, context, conversationHistory, questionCount) {
  const conversationSummary = conversationHistory.map((exchange, idx) => 
    `Q${idx + 1}: ${exchange.question?.text || 'Unknown'}\nA${idx + 1}: ${exchange.answer || 'No answer'}`
  ).join('\n\n');

  return `You are an intelligent project calibration assistant conducting a dynamic interview for repository: ${repo}

CURRENT CONTEXT:
- Files scanned: ${context.fileCount}
- Tech stack detected: ${context.techStack.join(', ') || 'None detected'}
- Project phase: ${context.phase}
- Question number: ${questionCount + 1}
- Existing CLAUDE.md: ${context.hasClaudeMd ? 'Yes' : 'No'}

CONVERSATION HISTORY:
${conversationSummary || 'No previous questions'}

ANSWERED TOPICS: ${context.answeredTopics.join(', ') || 'None'}

INSTRUCTIONS:
Generate the NEXT intelligent question that builds on previous answers. Follow these principles:

1. **CONTEXTUAL**: Base the question on what you've learned so far
2. **PROGRESSIVE**: Each question should deepen understanding
3. **ADAPTIVE**: Adjust based on user's technical level and responses
4. **COMPREHENSIVE**: Cover different aspects: business, technical, workflow, team, goals

QUESTION CATEGORIES TO ROTATE THROUGH:
- business: Project goals, target users, success metrics
- architecture: System design, patterns, scalability needs  
- workflow: Development process, deployment, testing
- team: Team size, roles, collaboration style
- preferences: Coding standards, tools, methodologies
- vision: Long-term goals, growth plans, priorities

SMART QUESTIONING RULES:
- Don't repeat topics already covered well
- Ask follow-up questions that dig deeper based on previous answers
- If user mentioned specific technologies, ask about implementation details
- If user described business goals, ask about technical requirements to achieve them
- Adapt question complexity to user's demonstrated technical level
- Ask about pain points and challenges they're facing

RESPONSE FORMAT:
{
  "question": {
    "text": "The actual question to ask",
    "category": "business|architecture|workflow|team|preferences|vision",
    "topic": "specific_topic_name",
    "type": "text|choice|multiple|scale",
    "options": ["option1", "option2"] // only if type is choice/multiple
    "voicePrompt": "How you'd ask this question in a natural conversation",
    "reasoning": "Why this question makes sense given the conversation history"
  },
  "progress": {
    "questionsAsked": ${questionCount + 1},
    "coverageAreas": ["list", "of", "topics", "covered"],
    "recommendedContinue": true|false
  }
}

Generate a question that makes the user feel like they're having an intelligent conversation with someone who understands their project and wants to help them succeed.`;
}