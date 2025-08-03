/**
 * Dynamic Calibration API - Generate next question based on conversation history
 */

import Anthropic from '@anthropic-ai/sdk';

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
  context.answeredQuestions = [];
  context.userPreferences = {};
  context.projectInsights = {};
  context.allAnswers = {};

  conversationHistory.forEach(exchange => {
    if (exchange.question && exchange.answer) {
      // Track both category and specific question
      context.answeredTopics.push(exchange.question.category || 'general');
      context.answeredQuestions.push({
        text: exchange.question.text,
        topic: exchange.question.topic,
        answer: exchange.answer
      });
      
      // Store all answers by topic for easy reference
      context.allAnswers[exchange.question.topic || exchange.question.category] = exchange.answer;
      
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

ALREADY ASKED QUESTIONS:
${context.answeredQuestions.map(q => `- "${q.text}" → "${q.answer}"`).join('\n') || 'None yet'}

COVERED TOPICS: ${[...new Set(context.answeredTopics)].join(', ') || 'None'}

PROJECT KNOWLEDGE SO FAR:
${Object.entries(context.allAnswers).map(([topic, answer]) => `- ${topic}: ${answer}`).join('\n') || 'No knowledge yet'}

INSTRUCTIONS:
Generate the NEXT intelligent question that builds on previous answers. Follow these principles:

1. **NEVER REPEAT**: Check conversation history - NEVER ask about topics already answered
2. **BUILD CONTEXT**: Each question must reference or build upon previous answers
3. **GO DEEPER**: Move from general to specific based on what you've learned
4. **TRACK COVERAGE**: Keep track of what's been asked and explore new territory

QUESTION CATEGORIES TO ROTATE THROUGH:
- business: Project goals, target users, success metrics
- architecture: System design, patterns, scalability needs  
- workflow: Development process, deployment, testing
- team: Team size, roles, collaboration style
- preferences: Coding standards, tools, methodologies
- vision: Long-term goals, growth plans, priorities

STRICT ANTI-REPETITION RULES:
- BEFORE generating a question, list ALL topics already covered in conversation
- NEVER ask about the project's "main purpose" or "primary goal" if already answered
- NEVER ask generic questions that ignore previous context
- Each question must explicitly reference something from a previous answer
- If user mentioned specific tech/features, dive into implementation details
- If all basic categories are covered, ask about specific challenges or edge cases

EXAMPLE PROGRESSION:
Q1: What's the main purpose? → A: E-commerce platform
Q2: What's your target market and scale? → A: SMB, expecting 10k users
Q3: Given your SMB focus, how will you handle multi-tenant isolation? → A: Separate DBs
Q4: With separate DBs for tenants, how will you manage migrations at scale?

TOPIC TRACKING:
Already asked about: ${context.answeredTopics.join(', ') || 'Nothing yet'}

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

IMPORTANT FINAL CHECKS:
1. Is this question already answered in the conversation? If yes, generate a different one
2. Does this question reference something specific from previous answers?
3. Is this question moving the conversation forward, not backward?
4. Would a human feel like you're listening to their previous answers?

Generate a question that makes the user feel like they're having an intelligent conversation with someone who understands their project and wants to help them succeed.`;
}