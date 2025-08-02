/**
 * MetaAgent - Intelligent orchestration layer for Terragon
 * Phase 1: Completely separate, no breaking changes
 */

const Anthropic = require('@anthropic-ai/sdk');
const ResearchAgent = require('./research.js');
const ContextEnhancer = require('./context-enhancer.js');
const RequirementsGatherer = require('./requirements.js');
const TaskDecomposer = require('./task-decomposer.js');
const TaskManager = require('./task-manager.js');
const ClaudeIntegrityChecker = require('../claude-integrity.js').default;
const fs = require('fs').promises;
const path = require('path');

class MetaAgent {
  constructor(config = {}) {
    this.config = {
      claudeApiKey: config.claudeApiKey || process.env.CLAUDE_API_KEY,
      perplexityApiKey: config.perplexityApiKey || process.env.PERPLEXITY_API_KEY,
      enabled: config.enabled || false,
      debugMode: config.debugMode || false,
      workingDir: config.workingDir || process.cwd()
    };

    // Only initialize if enabled
    if (this.config.enabled && this.config.claudeApiKey) {
      this.claude = new Anthropic({
        apiKey: this.config.claudeApiKey
      });
    }

    // Initialize components
    this.requestClassifier = new RequestClassifier();
    this.contextEnhancer = new ContextEnhancer({ workingDir: this.config.workingDir });
    this.researchAgent = new ResearchAgent({ perplexityApiKey: this.config.perplexityApiKey });
    this.requirementsGatherer = new RequirementsGatherer({
      claudeApiKey: this.config.claudeApiKey,
      perplexityApiKey: this.config.perplexityApiKey
    });
    this.taskDecomposer = new TaskDecomposer({
      claudeApiKey: this.config.claudeApiKey
    });
    this.taskManager = new TaskManager({
      workingDir: this.config.workingDir
    });
    
    // Initialize sacred document checker
    this.integrityChecker = new ClaudeIntegrityChecker(this.config.workingDir);
    this.claudeMdCache = null;
    this.claudeMdLastCheck = null;
  }

  /**
   * Main entry point - processes messages without breaking existing flow
   */
  async process(message, options = {}) {
    // Safety check - if disabled, return original message
    if (!this.config.enabled) {
      return {
        processedMessage: message,
        metadata: { skipped: true, reason: 'MetaAgent disabled' }
      };
    }

    try {
      // SACRED CHECK: Always read CLAUDE.md first
      await this.loadClaudeMd();
      
      // Check if this violates any sacred rules
      const enforcement = await this.integrityChecker.enforceRules({
        type: 'task',
        message: message,
        code: options.code
      });
      
      if (!enforcement.allowed) {
        return {
          processedMessage: message,
          metadata: {
            blocked: true,
            violations: enforcement.violations,
            reason: 'Sacred CLAUDE.md rules violation'
          }
        };
      }
      // Step 1: Classify the request
      const classification = await this.requestClassifier.classify(message);
      
      // Step 2: Build appropriate context
      const context = await this.contextEnhancer.gatherContext(classification);
      
      // Step 3: Enhance the message (but don't change it drastically)
      const enhanced = await this.enhanceMessage(message, classification, context);
      
      return {
        processedMessage: enhanced.message,
        metadata: {
          classification,
          context: context.summary,
          enhanced: true,
          confidence: enhanced.confidence
        }
      };
    } catch (error) {
      // On ANY error, return original message to not break flow
      console.error('MetaAgent error:', error);
      return {
        processedMessage: message,
        metadata: { 
          skipped: true, 
          reason: 'MetaAgent error',
          error: error.message 
        }
      };
    }
  }

  /**
   * Enhance message based on classification and context
   */
  async enhanceMessage(originalMessage, classification, context) {
    try {
      // Use the context enhancer for intelligent enhancement
      const enhanced = await this.contextEnhancer.enhance(
        originalMessage, 
        classification,
        { context }
      );
      
      return {
        message: enhanced.message,
        confidence: classification.confidence,
        metadata: enhanced.metadata
      };
    } catch (error) {
      // On error, return original
      console.error('Enhancement error:', error);
      return {
        message: originalMessage,
        confidence: 0.5
      };
    }
  }
  
  /**
   * Get requirements for action requests
   * This is exposed for UI to call separately
   */
  async gatherRequirements(message, context = {}) {
    if (!this.requirementsGatherer) {
      return null;
    }
    
    try {
      const analysis = await this.requirementsGatherer.analyzeRequest(message, context);
      return analysis;
    } catch (error) {
      console.error('Requirements gathering error:', error);
      return null;
    }
  }
  
  /**
   * Research a topic or error
   * This is exposed for UI to call separately
   */
  async research(query, options = {}) {
    if (!this.researchAgent || !this.researchAgent.enabled) {
      return null;
    }
    
    try {
      const results = await this.researchAgent.search(query, options);
      return results;
    } catch (error) {
      console.error('Research error:', error);
      return null;
    }
  }

  /**
   * Decompose a task into micro-tasks with full context
   */
  async decomposeTask(taskSpec, requirements = {}, codebaseContext = {}) {
    if (!this.taskDecomposer) {
      throw new Error('Task decomposer not available');
    }
    
    try {
      const microTasks = await this.taskDecomposer.decompose(taskSpec, requirements, codebaseContext);
      const validation = this.taskDecomposer.validateDecomposition(microTasks);
      
      return {
        microTasks,
        validation,
        totalTime: this.taskDecomposer.getTotalTime(microTasks),
        criticalPath: this.taskDecomposer.getCriticalPath(microTasks)
      };
    } catch (error) {
      console.error('Task decomposition error:', error);
      throw error; // Re-throw instead of returning null
    }
  }

  /**
   * Create a task with folder structure
   */
  async createTask(taskSpec) {
    if (!this.taskManager) {
      return null;
    }
    
    try {
      const result = await this.taskManager.createTask(taskSpec);
      return result;
    } catch (error) {
      console.error('Task creation error:', error);
      return null;
    }
  }

  /**
   * Full task processing pipeline
   */
  async processTaskRequest(message, options = {}) {
    try {
      // Step 1: Classify the request
      const classification = await this.requestClassifier.classify(message);
      
      if (classification.type !== 'ACTION_REQUEST') {
        return {
          success: false,
          reason: 'Not an action request',
          classification
        };
      }
      
      // Step 2: Gather requirements
      const requirements = await this.gatherRequirements(message);
      
      // Step 3: Research if enabled
      let research = null;
      if (this.researchAgent && this.researchAgent.enabled) {
        research = await this.research(`best practices for ${message}`);
      }
      
      // Step 4: Create task specification
      const taskSpec = {
        title: this.extractTitle(message),
        description: message,
        requirements: requirements?.questions || [],
        research
      };
      
      // Step 5: Decompose into micro-tasks
      const decomposition = await this.decomposeTask(taskSpec, requirements);
      
      // Step 6: Create task structure
      const task = await this.createTask({
        ...taskSpec,
        decomposition: decomposition?.microTasks || []
      });
      
      return {
        success: true,
        classification,
        requirements,
        research,
        decomposition,
        task
      };
    } catch (error) {
      console.error('Task processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract a title from the message
   */
  extractTitle(message) {
    // Simple extraction - take first few words
    const words = message.toLowerCase().split(' ');
    const keywords = words.filter(w => 
      !['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'].includes(w)
    );
    
    return keywords.slice(0, 4).join(' ');
  }

  /**
   * Check if meta-agent should process this request
   */
  shouldProcess(message, options = {}) {
    // Safety checks
    if (!this.config.enabled) return false;
    if (options.skipMetaAgent) return false;
    if (!message || message.length < 3) return false;
    
    return true;
  }
  
  /**
   * Load and cache CLAUDE.md content
   */
  async loadClaudeMd() {
    // Cache for 5 minutes
    const now = Date.now();
    if (this.claudeMdCache && this.claudeMdLastCheck && (now - this.claudeMdLastCheck) < 300000) {
      return this.claudeMdCache;
    }
    
    try {
      const claudeMdPath = path.join(this.config.workingDir, 'CLAUDE.md');
      const content = await fs.readFile(claudeMdPath, 'utf-8');
      
      // Verify integrity
      const integrity = await this.integrityChecker.checkIntegrity();
      if (!integrity.valid) {
        console.error('⚠️ CLAUDE.md integrity check failed:', integrity.message);
      }
      
      this.claudeMdCache = content;
      this.claudeMdLastCheck = now;
      
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📋 CLAUDE.md not found. Repository calibration required.');
        return null;
      }
      throw error;
    }
  }
  
  /**
   * Get sacred principles from CLAUDE.md
   */
  getSacredPrinciples() {
    if (!this.claudeMdCache) return [];
    
    const principlesMatch = this.claudeMdCache.match(/## \d+\. Sacred Rules[\s\S]*?(?=##|$)/);
    if (!principlesMatch) return [];
    
    return principlesMatch[0]
      .split('\n')
      .filter(line => line.match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*\*\*(.+?)\*\*.*/, '$1'));
  }
  
  /**
   * Check if calibration is required
   */
  async requiresCalibration() {
    try {
      const claudeMdPath = path.join(this.config.workingDir, 'CLAUDE.md');
      await fs.access(claudeMdPath);
      return false;
    } catch {
      return true;
    }
  }
}

/**
 * Classifies user requests into categories
 */
class RequestClassifier {
  constructor() {
    this.patterns = {
      ACTION_REQUEST: [
        /\b(implement|create|build|add|fix|refactor|update)\b/i,
        /\b(set up|setup|integrate|deploy)\b/i
      ],
      INFO_REQUEST: [
        /^(what|how|why|when|where|who|explain|tell me|describe)\b/i,
        /\b(does|is|are|can|could|should)\s+\w+\?$/i
      ],
      PLANNING_REQUEST: [
        /\b(plan|design|architect|structure|organize|think about)\b/i,
        /\b(approach|strategy|best way)\b/i
      ],
      STATUS_CHECK: [
        /\b(status|progress|update|how's|where are we)\b/i,
        /\b(going|doing|complete|done)\b/i
      ]
    };
  }

  async classify(message) {
    const lower = message.toLowerCase();
    
    // Check each pattern type
    for (const [type, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(lower)) {
          return {
            type,
            confidence: 0.8,
            reasoning: `Matched pattern for ${type}`
          };
        }
      }
    }

    // Default classification
    return {
      type: 'GENERAL',
      confidence: 0.5,
      reasoning: 'No specific pattern matched'
    };
  }
}


// Export for use
module.exports = MetaAgent;