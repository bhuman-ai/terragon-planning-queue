const Anthropic = require('@anthropic-ai/sdk');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { scanResults, existingAnswers } = req.body;

    // Try to use Claude to generate intelligent questions
    if (process.env.CLAUDE_API_KEY && process.env.CLAUDE_API_KEY !== 'your-claude-api-key-here') {
      const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

      try {
        const prompt = `You are conducting a sacred calibration interview for a software project. Based on the repository scan results, generate 10-15 highly specific questions to create a comprehensive CLAUDE.md document.

Repository scan shows:;
- Project name: ${scanResults.projectName || 'Unknown'}
- Tech stack: ${scanResults.detectedTechStack?.join(', ') || 'Unknown'}
- Current phase: ${scanResults.suggestedPhase || 'Unknown'}
- Has ${scanResults.fileCount || 0} documentation files
- Package version: ${scanResults.packageInfo?.version || 'Unknown'}

Already answered: ${JSON.stringify(existingAnswers || {})}

Generate questions that cover:
1. Project vision and business goals
2. Technical architecture decisions
3. Infrastructure and deployment
4. Security requirements
5. Performance targets
6. Team workflows
7. Coding standards
8. Future roadmap

Return JSON array of questions with this structure:
{
  'questions': [
    {
      'id': 'unique_id',
      'category': 'Category Name',
      'question': 'Specific question text',
      'type': 'text|single-choice|multi-choice',
      'options': ['option1', 'option2'], // only for choice types
      'required': true/false,
      'context': 'Why this matters'
    }
  ]
}`;

        const response = await claude.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 3000,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }]
        });

        const content = response.content[0].text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const questions = JSON.parse(jsonMatch[0]);
          return res.status(200).json(questions);
        }
      } catch (error) {
        console.error('Claude API error:', error);
      }
    }

    // Fallback to intelligent static questions based on scan results
    const questions = generateStaticQuestions(scanResults, existingAnswers);

    res.status(200).json({ questions });

  } catch (error) {
    console.error('Generate questions error:', error);
    res.status(500).json({
      error: 'Failed to generate questions',
      details: error.message
    });
  }
}

function generateStaticQuestions(scanResults, _existingAnswers) {
  const questions = [];

  // Always start with vision
  questions.push({
    id: 'vision',
    category: 'Project Foundation',
    question: 'What is the core vision and primary goal of this project? What problem does it solve?',
    type: 'text',
    required: true,
    context: 'This becomes the north star for all decisions'
  });

  // User and market
  questions.push({
    id: 'target_users',
    category: 'Project Foundation',
    question: 'Who are your target users and what are their main pain points?',
    type: 'text',
    required: true,
    context: 'Understanding users drives feature prioritization'
  });

  // Technical architecture based on detected stack
  if (scanResults.detectedTechStack?.includes('Next.js')) {
    questions.push({
      id: 'nextjs_routing',
      category: 'Technical Architecture',
      question: 'Which Next.js routing approach will you use?',
      type: 'single-choice',
      options: ['App Router (app/)', 'Pages Router (pages/)', 'Hybrid approach'],
      required: true,
      context: 'Fundamental architectural decision for Next.js projects'
    });
  }

  // Database strategy
  if (scanResults.detectedTechStack?.some(tech => ['Prisma', 'MongoDB', 'PostgreSQL'].includes(tech))) {
    questions.push({
      id: 'database_strategy',
      category: 'Data Architecture',
      question: 'What is your database schema evolution strategy?',
      type: 'single-choice',
      options: [
        'Strict migrations only',
        'Feature flags for schema changes',
        'Blue-green deployments',
        'Backwards compatible changes only'
      ],
      required: true,
      context: 'Critical for production database management'
    });
  }

  // Security requirements
  questions.push({
    id: 'security_requirements',
    category: 'Security',
    question: 'What are the critical security requirements for this project?',
    type: 'multi-choice',
    options: [
      'SOC2 compliance',
      'GDPR compliance',
      'End-to-end encryption',
      'PCI compliance',
      'HIPAA compliance',
      'Regular penetration testing',
      'Zero-trust architecture'
    ],
    required: true,
    context: 'Security requirements shape the entire architecture'
  });

  // Performance targets
  questions.push({
    id: 'performance_targets',
    category: 'Performance',
    question: 'What are your specific performance targets?',
    type: 'text',
    required: true,
    placeholder: 'e.g., <100ms API response time, <3s page load, 99.9% uptime',
    context: 'Concrete targets enable proper optimization'
  });

  // Team workflow
  questions.push({
    id: 'team_size',
    category: 'Team & Workflow',
    question: 'What is the current and expected team size?',
    type: 'single-choice',
    options: [
      'Solo developer',
      '2-5 developers',
      '6-20 developers',
      '20+ developers',
      'Multiple teams'
    ],
    required: true,
    context: 'Team size influences architecture and process decisions'
  });

  // Development workflow
  questions.push({
    id: 'deployment_frequency',
    category: 'Team & Workflow',
    question: 'How frequently do you plan to deploy to production?',
    type: 'single-choice',
    options: [
      'Multiple times per day',
      'Daily',
      'Weekly',
      'Bi-weekly sprints',
      'Monthly or less'
    ],
    required: true,
    context: 'Deployment frequency drives CI/CD requirements'
  });

  // Coding standards
  questions.push({
    id: 'coding_principles',
    category: 'Development Standards',
    question: 'What are the non-negotiable coding principles for this project?',
    type: 'text',
    required: true,
    multiline: true,
    placeholder: 'e.g., No magic numbers, 100% type safety, Test coverage > 80%, No any types',
    context: 'These become enforced rules in the codebase'
  });

  // State management (for frontend projects)
  if (scanResults.detectedTechStack?.some(tech => ['React', 'Vue.js', 'Next.js'].includes(tech))) {
    questions.push({
      id: 'state_management',
      category: 'Frontend Architecture',
      question: 'What is your state management strategy?',
      type: 'single-choice',
      options: [
        'Local state only (useState/useReducer)',
        'Context API',
        'Redux Toolkit',
        'Zustand',
        'Jotai/Recoil',
        'Server state only (React Query/SWR)',
        'Mixed approach'
      ],
      required: true,
      context: 'State management affects application complexity'
    });
  }

  // Error handling
  questions.push({
    id: 'error_strategy',
    category: 'Reliability',
    question: 'How should the system handle errors and failures?',
    type: 'multi-choice',
    options: [
      'Graceful degradation',
      'Circuit breakers',
      'Automatic retries with backoff',
      'Error boundaries',
      'Comprehensive logging',
      'User-friendly error messages',
      'Rollback capabilities'
    ],
    required: true,
    context: 'Error handling strategy affects user experience'
  });

  // Future scaling
  questions.push({
    id: 'scaling_expectations',
    category: 'Future Planning',
    question: 'What scale do you expect to reach in 12 months?',
    type: 'text',
    required: true,
    placeholder: 'e.g., 100K MAU, 1M requests/day, 10TB data',
    context: 'Scaling expectations influence architecture decisions'
  });

  // Integration requirements
  questions.push({
    id: 'third_party_integrations',
    category: 'Integrations',
    question: 'What third-party services must this project integrate with?',
    type: 'text',
    required: false,
    multiline: true,
    placeholder: 'List all external APIs, services, and systems',
    context: 'Integration points often become complexity bottlenecks'
  });

  // Business constraints
  questions.push({
    id: 'business_constraints',
    category: 'Constraints',
    question: 'What are the hard business constraints? (budget, timeline, regulations)',
    type: 'text',
    required: true,
    multiline: true,
    context: 'Constraints shape what is possible'
  });

  // Success metrics
  questions.push({
    id: 'success_metrics',
    category: 'Success Criteria',
    question: 'How will you measure the success of this project?',
    type: 'text',
    required: true,
    multiline: true,
    placeholder: 'e.g., User retention > 80%, Revenue growth 20% MoM, NPS > 50',
    context: 'Clear metrics enable focused development'
  });

  return questions;
}
