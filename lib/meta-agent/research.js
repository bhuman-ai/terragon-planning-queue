/**
 * Research capabilities for MetaAgent
 * Uses Perplexity API for real-time knowledge
 */

class ResearchAgent {
  constructor(config = {}) {
    this.apiKey = config.perplexityApiKey || process.env.PERPLEXITY_API_KEY;
    this.baseURL = 'https://api.perplexity.ai';
    this.enabled = !!this.apiKey;
  }

  /**
   * Research a topic with Perplexity
   */
  async search(query, options = {}) {
    if (!this.enabled) {
      return {
        success: false,
        reason: 'Perplexity API key not configured',
        results: []
      };
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || 'pplx-7b-online',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful research assistant. Provide accurate, current information with sources when possible.'
            },
            {
              role: 'user',
              content: query
            }
          ],
          temperature: 0.2,
          max_tokens: options.maxTokens || 1000,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.choices[0].message.content,
        usage: data.usage
      };
    } catch (error) {
      console.error('Research error:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Research implementation patterns
   */
  async researchImplementation(feature, techStack = {}) {
    const queries = [
      `Best practices for implementing ${feature} in ${techStack.framework || 'web app'} 2024`,
      `Common security issues when implementing ${feature}`,
      `Performance optimization for ${feature}`
    ];

    const results = await Promise.all(
      queries.map(q => this.search(q))
    );

    return this.synthesizeResults(results, feature);
  }

  /**
   * Research error solutions
   */
  async researchError(error, context = {}) {
    const errorQuery = `${error.message} ${context.framework || ''} solution`;
    const result = await this.search(errorQuery);
    
    if (result.success) {
      return this.extractSolutions(result.content);
    }
    
    return [];
  }

  /**
   * Gather requirements intelligently
   */
  async gatherRequirements(userRequest, existingContext = {}) {
    // Research similar implementations
    const research = await this.search(
      `What are the key requirements and considerations when implementing ${userRequest}?`
    );

    if (!research.success) {
      return this.getFallbackQuestions(userRequest);
    }

    // Extract requirements from research
    const requirements = this.extractRequirements(research.content);
    
    // Generate clarifying questions
    return this.generateQuestions(requirements, existingContext);
  }

  /**
   * Extract actionable requirements from research
   */
  extractRequirements(researchContent) {
    // Simple extraction for Phase 1
    const requirements = [];
    
    // Look for common requirement patterns
    const patterns = [
      /(?:requires?|needs?|must have|should have)\s+([^.]+)/gi,
      /(?:consider|ensure|make sure)\s+([^.]+)/gi,
      /(?:important to|critical to|essential to)\s+([^.]+)/gi
    ];

    for (const pattern of patterns) {
      const matches = researchContent.matchAll(pattern);
      for (const match of matches) {
        requirements.push(match[1].trim());
      }
    }

    return requirements;
  }

  /**
   * Generate smart questions based on research
   */
  generateQuestions(requirements, context) {
    const questions = [];

    // Convert requirements to questions
    for (const req of requirements.slice(0, 5)) { // Limit to 5 questions
      if (req.includes('security')) {
        questions.push({
          category: 'security',
          question: `Security consideration: ${req}. How should we handle this?`,
          options: ['Implement as suggested', 'Skip for MVP', 'Custom approach']
        });
      } else if (req.includes('performance')) {
        questions.push({
          category: 'performance',
          question: `Performance consideration: ${req}. Is this a priority?`,
          options: ['Yes, optimize now', 'No, optimize later', 'Not applicable']
        });
      } else {
        questions.push({
          category: 'general',
          question: `Requirement: ${req}. Should we include this?`,
          options: ['Yes', 'No', 'Modify']
        });
      }
    }

    return questions;
  }

  /**
   * Fallback questions when research fails
   */
  getFallbackQuestions(userRequest) {
    return [
      {
        category: 'scope',
        question: 'What is the primary goal of this implementation?',
        options: []
      },
      {
        category: 'constraints',
        question: 'Are there any specific constraints or requirements?',
        options: []
      },
      {
        category: 'timeline',
        question: 'What is the expected timeline?',
        options: ['ASAP', 'This week', 'This month', 'No rush']
      }
    ];
  }

  /**
   * Synthesize multiple research results
   */
  synthesizeResults(results, topic) {
    const synthesis = {
      topic,
      timestamp: new Date().toISOString(),
      findings: [],
      recommendations: [],
      warnings: []
    };

    // Extract key points from each result
    for (const result of results) {
      if (result.success && result.content) {
        // Simple extraction for Phase 1
        if (result.content.includes('security') || result.content.includes('vulnerability')) {
          synthesis.warnings.push(result.content.substring(0, 200));
        }
        if (result.content.includes('recommend') || result.content.includes('best practice')) {
          synthesis.recommendations.push(result.content.substring(0, 200));
        }
        synthesis.findings.push(result.content.substring(0, 100));
      }
    }

    return synthesis;
  }

  /**
   * Extract solutions from error research
   */
  extractSolutions(content) {
    const solutions = [];
    
    // Look for solution patterns
    const patterns = [
      /(?:fix|solution|resolve|try)\s*:?\s*([^.]+)/gi,
      /(?:you can|you should|you need to)\s+([^.]+)/gi
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        solutions.push({
          suggestion: match[1].trim(),
          confidence: 0.7
        });
      }
    }

    return solutions.slice(0, 3); // Return top 3 solutions
  }
}

module.exports = ResearchAgent;