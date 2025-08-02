/**
 * Context-Aware Requirements Gathering System
 * Analyzes codebase and CLAUDE.md before generating questions
 */

const Anthropic = require('@anthropic-ai/sdk');
const ResearchAgent = require('./research.js');
const fs = require('fs').promises;
const path = require('path');

class RequirementsGatherer {
  constructor(config = {}) {
    this.claudeApiKey = config.claudeApiKey || process.env.CLAUDE_API_KEY;
    this.researchAgent = new ResearchAgent(config);
    
    if (this.claudeApiKey) {
      this.claude = new Anthropic({ apiKey: this.claudeApiKey });
    }
  }

  /**
   * Phase 1: Generate pre-research questions (basic clarification)
   */
  async generatePreResearchQuestions(message, context = {}) {
    console.log('🧠 Generating dynamic pre-research questions for:', message);
    
    if (!this.claude) {
      throw new Error('Claude API is required for dynamic question generation');
    }

    // First, check if we have project documentation
    let projectContext = '';
    try {
      const claudeMd = await fs.readFile(path.join(process.cwd(), 'CLAUDE.md'), 'utf-8');
      projectContext = `\nPROJECT CONTEXT:\n${claudeMd.substring(0, 3000)}...\n`;
    } catch (error) {
      // No CLAUDE.md file
    }

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: `You are an intelligent requirements analyst. Generate 5 clarifying questions to better understand this task request.
${projectContext}
IMPORTANT: Look at the project context above FIRST. If the answer to a potential question is already in the project docs, DON'T ASK IT. Only ask questions that aren't already answered in the documentation.

Task: "${message}"

Generate DYNAMIC questions that are specifically tailored to this exact task. DO NOT use generic templates or placeholders.

Requirements:
1. Questions must be specific to the task mentioned
2. Mix of question types: single-choice, multi-choice, and text input
3. Questions should gather essential information before research
4. Each question should have a clear purpose
5. NO GENERIC QUESTIONS - each must be uniquely relevant to "${message}"

Return a JSON array with exactly 5 questions:
{
  "questions": [
    {
      "id": "q1",
      "type": "single-choice|multi-choice|text",
      "question": "Specific question text",
      "options": ["option1", "option2"] // only for choice questions
    }
  ]
}

Examples of DYNAMIC questions:
- For "implement user authentication": "Which authentication methods should be supported?"
- For "create a dashboard": "What key metrics should the dashboard display?"
- For "optimize database queries": "Which specific queries are currently slow?"

Generate questions that show you understand the specific task context.`
        }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const questions = JSON.parse(jsonMatch[0]);
        console.log(`✅ Generated ${questions.questions.length} dynamic pre-research questions`);
        
        return {
          phase: 'pre-research',
          questions: questions.questions,
          message: message,
          context: context
        };
      }
    } catch (error) {
      console.error('Failed to generate dynamic pre-research questions:', error);
      throw error;
    }
    
    throw new Error('Failed to generate dynamic questions');
  }

  /**
   * Phase 2: Generate post-research questions (informed by research and codebase)
   */
  async generatePostResearchQuestions(message, preResearchAnswers, context = {}) {
    console.log('🧠 Generating post-research questions with full context...');
    
    // First, analyze the codebase context
    const codebaseContext = await this.analyzeCodebaseContext(message, context);
    
    // Conduct research with pre-research context
    let research = null;
    if (this.researchAgent && this.researchAgent.enabled) {
      console.log('🔍 Starting Perplexity research for:', message);
      const researchQuery = this.buildEnhancedResearchQuery(message, preResearchAnswers);
      research = await this.researchAgent.search(researchQuery, {
        maxTokens: 1000
      });
      console.log('🔍 Research completed');
    }
    
    // Merge all contexts
    const enrichedContext = {
      ...context,
      ...codebaseContext,
      preResearchAnswers,
      research,
      message
    };
    
    // Generate intelligent questions using Claude with full context
    if (this.claude) {
      try {
        const smartQuestions = await this.generateIntelligentPostResearchQuestions(message, enrichedContext);
        if (smartQuestions && smartQuestions.questions.length > 0) {
          return {
            phase: 'post-research',
            questions: smartQuestions.questions,
            research: research,
            context: codebaseContext,
            reasoning: smartQuestions.reasoning,
            preResearchAnswers
          };
        }
      } catch (error) {
        console.error('Post-research question generation failed:', error);
      }
    }
    
    // Fallback to basic post-research questions
    const questions = this.generateBasicPostResearchQuestions(message, enrichedContext);
    
    return {
      phase: 'post-research',
      questions,
      research: research,
      context: codebaseContext,
      preResearchAnswers
    };
  }

  /**
   * Build enhanced research query based on pre-research answers
   */
  buildEnhancedResearchQuery(message, preResearchAnswers) {
    let query = `best practices for ${message}`;
    
    if (preResearchAnswers.scope) {
      query += ` ${preResearchAnswers.scope.toLowerCase()}`;
    }
    
    if (preResearchAnswers.constraints) {
      query += ` with constraints: ${preResearchAnswers.constraints}`;
    }
    
    if (preResearchAnswers.user_impact) {
      const impacts = Array.isArray(preResearchAnswers.user_impact) 
        ? preResearchAnswers.user_impact.join(' ') 
        : preResearchAnswers.user_impact;
      query += ` considering ${impacts}`;
    }
    
    return query;
  }
  
  /**
   * Analyze codebase to understand project context
   */
  async analyzeCodebaseContext(message, uiContext = {}) {
    const context = {
      projectType: 'unknown',
      techStack: [],
      existingFeatures: [],
      architecture: null,
      claudeMdInsights: null,
      relevantFiles: [],
      currentStructure: {},
      existingPatterns: []
    };
    
    try {
      // 1. Read CLAUDE.md for project context
      const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
      if (fs.existsSync(claudeMdPath)) {
        const claudeContent = fs.readFileSync(claudeMdPath, 'utf-8');
        context.claudeMdInsights = this.extractClaudeInsights(claudeContent);
      }
      
      // 2. Analyze package.json for tech stack
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        context.techStack = this.extractTechStack(packageJson);
        
        // Prioritize GitHub repo name from UI over package.json name
        if (uiContext.githubRepo) {
          context.projectType = uiContext.githubRepo;
        } else {
          context.projectType = packageJson.name || 'unknown';
        }
        
        context.existingFeatures = this.detectExistingFeatures(packageJson);
      }
      
      // 3. Analyze project structure
      context.currentStructure = this.analyzeProjectStructure();
      
      // 4. Find relevant files based on message
      context.relevantFiles = this.findRelevantFiles(message);
      
      // 5. Detect existing patterns
      context.existingPatterns = this.detectCodePatterns();
      
    } catch (error) {
      console.error('Error analyzing codebase:', error);
    }
    
    return context;
  }
  
  /**
   * Extract insights from CLAUDE.md
   */
  extractClaudeInsights(content) {
    const insights = {
      projectVision: null,
      techStack: [],
      codingStandards: [],
      currentPhase: null,
      activeTask: null,
      architecture: null
    };
    
    // Extract project overview
    const overviewMatch = content.match(/## 1\. Project Overview([\s\S]*?)## 2\./);
    if (overviewMatch) {
      const overview = overviewMatch[1];
      
      // Extract vision
      const visionMatch = overview.match(/\*\*Vision:\*\*\s*(.+)/);
      if (visionMatch) insights.projectVision = visionMatch[1].trim();
      
      // Extract current phase
      const phaseMatch = overview.match(/\*\*Current Phase:\*\*\s*(.+)/);
      if (phaseMatch) insights.currentPhase = phaseMatch[1].trim();
      
      // Extract architecture
      const archMatch = overview.match(/\*\*Key Architecture:\*\*\s*(.+)/);
      if (archMatch) insights.architecture = archMatch[1].trim();
    }
    
    // Extract active tasks
    const activeTasksMatch = content.match(/## Active Tasks([\s\S]*?)(?=##|$)/);
    if (activeTasksMatch) {
      const tasks = activeTasksMatch[1];
      const inProgressTask = tasks.match(/### Task \d+:([^✅]*?)(?=###|$)/);
      if (inProgressTask) {
        insights.activeTask = inProgressTask[1].trim();
      }
    }
    
    // Extract coding standards
    const standardsMatch = content.match(/## 3\. Coding Standards([\s\S]*?)(?=## 4\.|$)/);
    if (standardsMatch) {
      const standards = standardsMatch[1];
      insights.codingStandards = standards
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^\s*-\s*/, '').trim());
    }
    
    return insights;
  }
  
  /**
   * Extract tech stack from package.json
   */
  extractTechStack(packageJson) {
    const stack = [];
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // Frameworks
    if (deps.next) stack.push('Next.js');
    if (deps.react) stack.push('React');
    if (deps.vue) stack.push('Vue.js');
    if (deps.express) stack.push('Express');
    if (deps.fastapi) stack.push('FastAPI');
    
    // Databases
    if (deps.prisma) stack.push('Prisma');
    if (deps.mongoose) stack.push('MongoDB');
    if (deps.pg || deps.postgres) stack.push('PostgreSQL');
    if (deps.mysql2) stack.push('MySQL');
    
    // Styling
    if (deps.tailwindcss) stack.push('Tailwind CSS');
    if (deps['styled-components']) stack.push('Styled Components');
    
    // AI/APIs
    if (deps['@anthropic-ai/sdk']) stack.push('Claude AI');
    if (deps.openai) stack.push('OpenAI');
    if (deps.stripe) stack.push('Stripe');
    
    return stack;
  }
  
  /**
   * Detect existing features from dependencies
   */
  detectExistingFeatures(packageJson) {
    const features = [];
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps['@anthropic-ai/sdk'] || deps.openai) features.push('AI Integration');
    if (deps.stripe) features.push('Payment Processing');
    if (deps['@auth0/nextjs-auth0'] || deps['next-auth']) features.push('Authentication');
    if (deps.socket || deps['socket.io']) features.push('Real-time Features');
    if (deps.prisma || deps.mongoose) features.push('Database Integration');
    
    return features;
  }
  
  /**
   * Analyze project structure
   */
  analyzeProjectStructure() {
    const structure = {
      hasPages: false,
      hasComponents: false,
      hasApi: false,
      hasLib: false,
      hasTasks: false,
      hasTests: false
    };
    
    try {
      const dirs = ['pages', 'components', 'lib', 'api', 'tasks', 'test', 'tests', '__tests__'];
      
      for (const dir of dirs) {
        if (fs.existsSync(path.join(process.cwd(), dir))) {
          structure[`has${dir.charAt(0).toUpperCase() + dir.slice(1)}`] = true;
        }
      }
      
      // Check for API routes in pages/api or app/api
      if (fs.existsSync(path.join(process.cwd(), 'pages', 'api')) || 
          fs.existsSync(path.join(process.cwd(), 'app', 'api'))) {
        structure.hasApi = true;
      }
    } catch (error) {
      // Ignore errors
    }
    
    return structure;
  }
  
  /**
   * Find files relevant to the user's message
   */
  findRelevantFiles(message) {
    const keywords = this.extractKeywords(message);
    const relevantFiles = [];
    
    try {
      for (const keyword of keywords) {
        const files = this.searchFiles(process.cwd(), keyword);
        relevantFiles.push(...files);
      }
    } catch (error) {
      // Ignore search errors
    }
    
    return [...new Set(relevantFiles)].slice(0, 10); // Limit to top 10
  }
  
  /**
   * Extract keywords from message for file search
   */
  extractKeywords(message) {
    const words = message.toLowerCase().split(/\s+/);
    const keywords = [];
    
    const featureKeywords = [
      'auth', 'authentication', 'login', 'user', 
      'payment', 'stripe', 'billing',
      'api', 'endpoint', 'route',
      'database', 'schema', 'migration',
      'component', 'ui', 'frontend',
      'chat', 'stream', 'websocket',
      'task', 'agent', 'meta'
    ];
    
    for (const word of words) {
      for (const keyword of featureKeywords) {
        if (word.includes(keyword) || keyword.includes(word)) {
          keywords.push(keyword);
        }
      }
    }
    
    return [...new Set(keywords)];
  }
  
  /**
   * Search for files containing keyword
   */
  searchFiles(dir, keyword, results = [], depth = 0) {
    if (depth > 2) return results; // Limit depth
    
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.startsWith('.') || file === 'node_modules') continue;
        
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          this.searchFiles(fullPath, keyword, results, depth + 1);
        } else if (file.toLowerCase().includes(keyword) || 
                   (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.tsx'))) {
          // Check file content for keyword
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.toLowerCase().includes(keyword)) {
              results.push(fullPath.replace(process.cwd() + '/', ''));
            }
          } catch (e) {
            // Ignore read errors
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
    
    return results;
  }
  
  /**
   * Detect existing code patterns
   */
  detectCodePatterns() {
    const patterns = [];
    
    try {
      // Check for common patterns
      if (fs.existsSync(path.join(process.cwd(), 'lib', 'meta-agent'))) {
        patterns.push('Meta-Agent Architecture');
      }
      
      if (fs.existsSync(path.join(process.cwd(), 'pages', 'api'))) {
        patterns.push('Next.js API Routes');
      }
      
      if (fs.existsSync(path.join(process.cwd(), 'components'))) {
        patterns.push('Component-Based Architecture');
      }
      
    } catch (error) {
      // Ignore errors
    }
    
    return patterns;
  }
  
  /**
   * Generate intelligent post-research questions using Claude
   */
  async generateIntelligentPostResearchQuestions(message, context) {
    const prompt = `You are analyzing a development task that has been pre-screened by the user. Generate 3-5 highly specific, technical questions that will help create a precise implementation plan.

USER REQUEST: "${message}"

PRE-RESEARCH ANSWERS:
- Scope: ${context.preResearchAnswers?.scope || 'Not specified'}
- Priority: ${context.preResearchAnswers?.priority || 'Not specified'}
- User Impact: ${Array.isArray(context.preResearchAnswers?.user_impact) ? context.preResearchAnswers.user_impact.join(', ') : context.preResearchAnswers?.user_impact || 'Not specified'}
- Constraints: ${context.preResearchAnswers?.constraints || 'None specified'}
- Context: ${context.preResearchAnswers?.context || 'None provided'}

CODEBASE ANALYSIS:
- Project: ${context.projectType}
- Tech Stack: ${context.techStack?.join(', ')}
- Existing Features: ${context.existingFeatures?.join(', ')}
- Architecture: ${context.claudeMdInsights?.architecture || 'Unknown'}
- Current Phase: ${context.claudeMdInsights?.currentPhase || 'Unknown'}
- Project Structure: ${JSON.stringify(context.currentStructure)}
- Relevant Files: ${context.relevantFiles?.slice(0, 5).join(', ')}

RESEARCH FINDINGS: ${context.research?.success ? context.research.content.substring(0, 800) : 'No research available'}

Generate questions that are:
1. **Technically specific** - Ask about exact implementation details, not general preferences
2. **Context-informed** - Based on the existing codebase, research findings, and user answers
3. **Implementation-focused** - Help clarify HOW to build this, not WHAT to build
4. **Architecture-aware** - Consider the existing project structure and patterns
5. **Research-informed** - Incorporate insights from the research findings

Return a JSON object with this structure:
{
  "questions": [
    {
      "id": "specific-technical-id",
      "question": "Specific technical question based on research and codebase analysis",
      "type": "choice|boolean|text|multiple",
      "options": ["option1", "option2"] // if choice/multiple type
      "explanation": "Why this question is critical for this specific implementation",
      "category": "technical|integration|architecture|performance|security"
    }
  ],
  "reasoning": "Brief explanation of how research and codebase analysis informed these questions"
}

Make these questions feel like they come from a senior developer who has studied the research, understands the codebase, and knows exactly what technical decisions need to be made.`;

    try {
      // Try Opus 4 first, fallback to Sonnet 4
      let modelToUse = 'claude-opus-4-20250514';
      let response;
      
      try {
        response = await this.claude.messages.create({
          model: modelToUse,
          max_tokens: 3000,
          temperature: 0.2,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });
      } catch (error) {
        if (error.message?.includes('model') || error.status === 400) {
          console.log('🔄 Opus 4 unavailable, falling back to Sonnet 4...');
          modelToUse = 'claude-sonnet-4-20250514';
          
          try {
            response = await this.claude.messages.create({
              model: modelToUse,
              max_tokens: 3000,
              temperature: 0.2,
              messages: [{
                role: 'user',
                content: prompt
              }]
            });
          } catch (fallbackError) {
            console.log('🔄 Sonnet 4 unavailable, using Haiku...');
            modelToUse = 'claude-3-haiku-20240307';
            response = await this.claude.messages.create({
              model: modelToUse,
              max_tokens: 2000,
              temperature: 0.3,
              messages: [{
                role: 'user',
                content: prompt
              }]
            });
          }
        } else {
          throw error;
        }
      }
      
      console.log(`✅ Post-research questions using model: ${modelToUse}`);

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Post-research question generation failed:', error);
    }
    
    return null;
  }

  /**
   * DEPRECATED: Generate context-aware questions using Claude (old single-phase method)
   */
  async generateContextAwareQuestions(message, context) {
    const prompt = `You are analyzing a user request for a coding task. Based on the codebase analysis below, generate 3-5 highly specific and relevant questions that will help clarify exactly what needs to be built.

USER REQUEST: "${message}"

CODEBASE CONTEXT:
- Project: ${context.projectType}
- Tech Stack: ${context.techStack.join(', ')}
- Existing Features: ${context.existingFeatures.join(', ')}
- Project Structure: ${JSON.stringify(context.currentStructure)}
- Architecture: ${context.claudeMdInsights?.architecture || 'Unknown'}
- Current Phase: ${context.claudeMdInsights?.currentPhase || 'Unknown'}
- Active Task: ${context.claudeMdInsights?.activeTask || 'None'}
- Relevant Files Found: ${context.relevantFiles.slice(0, 5).join(', ')}
- Existing Patterns: ${context.existingPatterns.join(', ')}

PROJECT VISION: ${context.claudeMdInsights?.projectVision || 'Not specified'}

CODING STANDARDS: ${context.claudeMdInsights?.codingStandards?.slice(0, 3).join('; ') || 'Standard practices'}

Generate questions that are:
1. Specific to this project's tech stack and architecture
2. Relevant to the user's request
3. Help eliminate ambiguity
4. Consider existing features and patterns
5. Align with the project's vision and current phase

Return a JSON object with this structure:
{
  "questions": [
    {
      "id": "specific-id",
      "question": "Specific question based on context",
      "type": "choice|boolean|text|multiple",
      "options": ["option1", "option2"] // if choice/multiple type
      "explanation": "Why this question is important for this specific project",
      "category": "technical|implementation|integration"
    }
  ],
  "reasoning": "Brief explanation of why these specific questions were chosen"
}

Make the questions feel like they come from someone who understands this specific codebase.`;

    try {
      // Try Opus 4 first, fallback to Sonnet 4
      let modelToUse = 'claude-opus-4-20250514';
      let response;
      
      try {
        response = await this.claude.messages.create({
          model: modelToUse,
          max_tokens: 3000,
          temperature: 0.2,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });
      } catch (error) {
        if (error.message?.includes('model') || error.status === 400) {
          console.log('🔄 Opus 4 unavailable, falling back to Sonnet 4...');
          modelToUse = 'claude-sonnet-4-20250514';
          
          try {
            response = await this.claude.messages.create({
              model: modelToUse,
              max_tokens: 3000,
              temperature: 0.2,
              messages: [{
                role: 'user',
                content: prompt
              }]
            });
          } catch (fallbackError) {
            console.log('🔄 Sonnet 4 unavailable, using Haiku...');
            modelToUse = 'claude-3-haiku-20240307';
            response = await this.claude.messages.create({
              model: modelToUse,
              max_tokens: 2000,
              temperature: 0.3,
              messages: [{
                role: 'user',
                content: prompt
              }]
            });
          }
        } else {
          throw error;
        }
      }
      
      console.log(`✅ Requirements using model: ${modelToUse}`);

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Claude question generation failed:', error);
    }
    
    return null;
  }
  
  /**
   * Generate basic post-research questions as fallback
   */
  generateBasicPostResearchQuestions(message, context) {
    const questions = [];
    
    // Technical implementation question informed by research
    questions.push({
      id: 'implementation-approach',
      question: `Based on the research findings, what implementation approach should we use for "${message}"?`,
      type: 'choice',
      options: [
        'Follow industry best practices from research',
        'Adapt patterns to fit existing codebase',
        'Custom implementation for specific needs',
        'Hybrid approach combining multiple patterns'
      ],
      category: 'technical',
      explanation: 'Research findings help choose the best implementation strategy'
    });
    
    // Integration question based on codebase analysis
    if (context.existingFeatures && context.existingFeatures.length > 0) {
      questions.push({
        id: 'integration-specifics',
        question: `How should this integrate with your existing ${context.existingFeatures.join(', ')} features?`,
        type: 'multiple',
        options: [
          'Extend existing functionality',
          'Create new independent module',
          'Refactor existing code to accommodate',
          'Add new API endpoints',
          'Update database schema',
          'Modify authentication flow'
        ],
        category: 'integration',
        explanation: 'Specific integration requirements based on existing features'
      });
    }
    
    // Architecture question based on project structure
    if (context.currentStructure) {
      questions.push({
        id: 'architecture-decisions',
        question: `Given your project structure, where should the main implementation go?`,
        type: 'choice',
        options: [
          'Create new directory following existing patterns',
          'Extend existing modules',
          'Add to lib/ directory',
          'Create separate service',
          'Update existing components'
        ],
        category: 'architecture',
        explanation: 'Architectural placement within existing project structure'
      });
    }
    
    // Performance question if research indicates performance considerations
    if (context.research?.content?.toLowerCase().includes('performance')) {
      questions.push({
        id: 'performance-requirements',
        question: 'Based on research findings about performance, what are your requirements?',
        type: 'multiple',
        options: [
          'Optimize for speed',
          'Optimize for memory usage',
          'Handle high concurrency',
          'Implement caching',
          'Async/background processing',
          'Database query optimization'
        ],
        category: 'performance',
        explanation: 'Performance considerations identified in research'
      });
    }
    
    // Security question if research mentions security
    if (context.research?.content?.toLowerCase().includes('security')) {
      questions.push({
        id: 'security-considerations',
        question: 'What security measures should be implemented based on the research?',
        type: 'multiple',
        options: [
          'Input validation and sanitization',
          'Authentication/authorization checks',
          'Data encryption',
          'Rate limiting',
          'CORS configuration',
          'SQL injection prevention'
        ],
        category: 'security',
        explanation: 'Security best practices from research findings'
      });
    }
    
    return questions.slice(0, 5); // Limit to 5 questions
  }

  /**
   * DEPRECATED: Generate basic context-aware questions as fallback (old method)
   */
  generateBasicContextAwareQuestions(message, context) {
    const questions = [];
    
    // Always ask for clarification but make it contextual
    questions.push({
      id: 'specific-requirements',
      question: `Given that this is a ${context.techStack.join(' + ')} project with ${context.existingFeatures.join(', ')}, what specific aspects of "${message}" should we focus on?`,
      type: 'text',
      multiline: true,
      category: 'clarification',
      explanation: 'Understanding the specific scope within your existing architecture'
    });
    
    // Integration question based on existing features
    if (context.existingFeatures.length > 0) {
      questions.push({
        id: 'integration-approach',
        question: `How should this integrate with your existing ${context.existingFeatures.join(', ')}?`,
        type: 'choice',
        options: [
          'Build on existing patterns',
          'Create new independent feature', 
          'Enhance existing functionality',
          'Replace existing implementation'
        ],
        category: 'integration',
        explanation: 'Ensuring consistency with your current architecture'
      });
    }
    
    // Tech stack specific question
    if (context.techStack.includes('Next.js')) {
      questions.push({
        id: 'nextjs-approach',
        question: 'Should this use Next.js App Router or Pages Router (based on your current setup)?',
        type: 'choice',
        options: [
          'App Router (app/ directory)',
          'Pages Router (pages/ directory)', 
          'Follow existing pattern',
          'Mixed approach'
        ],
        category: 'technical',
        explanation: 'Matching your current Next.js architecture'
      });
    }
    
    // Priority based on current phase
    const phase = context.claudeMdInsights?.currentPhase;
    if (phase) {
      questions.push({
        id: 'phase-alignment',
        question: `Given that your project is in "${phase}" phase, what's the priority level for this feature?`,
        type: 'choice',
        options: [
          'Critical for current phase',
          'Nice to have for current phase',
          'Preparation for next phase',
          'Future consideration'
        ],
        category: 'planning',
        explanation: 'Aligning with your current development phase'
      });
    }
    
    return questions;
  }
}

module.exports = RequirementsGatherer;