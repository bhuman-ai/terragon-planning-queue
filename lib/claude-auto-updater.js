/**
 * Claude Auto-Updater - Automated Living Document Update System
 * Monitors project state changes and automatically updates CLAUDE.md
 * Maintains sacred document integrity through intelligent triggers
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ClaudeAutoUpdater {
  constructor(config = {}) {
    this.projectRoot = config.projectRoot || process.cwd();
    this.claudeApiKey = config.claudeApiKey || process.env.CLAUDE_API_KEY;
    this.claudeMdPath = path.join(this.projectRoot, 'CLAUDE.md');
    this.metaDir = path.join(this.projectRoot, '.claude');
    this.stateFile = path.join(this.metaDir, 'project-state.json');
    this.updateLogFile = path.join(this.metaDir, 'update-log.json');
    
    if (this.claudeApiKey) {
      this.claude = new Anthropic({ apiKey: this.claudeApiKey });
    }
    
    // Ensure meta directory exists
    this.ensureMetaDirectory();
  }

  async ensureMetaDirectory() {
    try {
      await fs.mkdir(this.metaDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Main trigger detection - check for changes that require CLAUDE.md updates
   */
  async detectUpdateTriggers() {
    const triggers = {
      timestamp: new Date().toISOString(),
      changes: [],
      updateRequired: false,
      priority: 'low'
    };

    try {
      const currentState = await this.captureProjectState();
      const previousState = await this.loadPreviousState();
      
      // Compare states and detect significant changes
      const changes = await this.compareProjectStates(currentState, previousState);
      
      for (const change of changes) {
        triggers.changes.push(change);
        
        // Determine if this change requires CLAUDE.md update
        if (this.requiresClaudeMdUpdate(change)) {
          triggers.updateRequired = true;
          
          // Set priority based on change type
          if (change.type === 'CRITICAL' || change.severity === 'HIGH') {
            triggers.priority = 'high';
          } else if (triggers.priority !== 'high' && change.severity === 'MEDIUM') {
            triggers.priority = 'medium';
          }
        }
      }
      
      // Save current state for next comparison
      await this.saveProjectState(currentState);
      
    } catch (error) {
      console.error('Error detecting update triggers:', error);
      triggers.error = error.message;
    }

    return triggers;
  }

  /**
   * Capture current project state for comparison
   */
  async captureProjectState() {
    const state = {
      timestamp: new Date().toISOString(),
      packageJson: null,
      dependencies: {},
      devDependencies: {},
      fileStructure: {},
      claudeMdChecksum: null,
      gitInfo: null,
      techStack: [],
      envVars: []
    };

    try {
      // Capture package.json
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
        state.packageJson = JSON.parse(packageContent);
        state.dependencies = state.packageJson.dependencies || {};
        state.devDependencies = state.packageJson.devDependencies || {};
        
        // Extract tech stack from dependencies
        state.techStack = this.extractTechStack(state.packageJson);
      }

      // Capture key file structure
      state.fileStructure = await this.captureFileStructure();
      
      // Capture CLAUDE.md checksum
      if (await this.fileExists(this.claudeMdPath)) {
        const claudeContent = await fs.readFile(this.claudeMdPath, 'utf-8');
        state.claudeMdChecksum = this.calculateChecksum(claudeContent);
      }
      
      // Capture environment variables (keys only, not values)
      state.envVars = await this.captureEnvVarKeys();
      
      // Capture git info
      state.gitInfo = await this.captureGitInfo();
      
    } catch (error) {
      console.error('Error capturing project state:', error);
      state.error = error.message;
    }

    return state;
  }

  /**
   * Compare current and previous project states
   */
  async compareProjectStates(current, previous) {
    const changes = [];
    
    if (!previous) {
      changes.push({
        type: 'INITIAL_STATE',
        severity: 'LOW',
        message: 'First state capture - baseline established',
        requiresUpdate: false
      });
      return changes;
    }

    try {
      // Check dependency changes
      const depChanges = this.compareDependencies(current, previous);
      changes.push(...depChanges);
      
      // Check file structure changes
      const structureChanges = this.compareFileStructure(current, previous);
      changes.push(...structureChanges);
      
      // Check tech stack changes
      const techChanges = this.compareTechStack(current, previous);
      changes.push(...techChanges);
      
      // Check version changes
      const versionChanges = this.compareVersions(current, previous);
      changes.push(...versionChanges);
      
      // Check environment variable changes
      const envChanges = this.compareEnvVars(current, previous);
      changes.push(...envChanges);
      
    } catch (error) {
      changes.push({
        type: 'COMPARISON_ERROR',
        severity: 'HIGH',
        message: `Error comparing states: ${error.message}`,
        requiresUpdate: false
      });
    }

    return changes;
  }

  /**
   * Compare dependencies between states
   */
  compareDependencies(current, previous) {
    const changes = [];
    
    // Check added dependencies
    for (const [dep, version] of Object.entries(current.dependencies || {})) {
      if (!previous.dependencies?.[dep]) {
        changes.push({
          type: 'DEPENDENCY_ADDED',
          severity: 'MEDIUM',
          message: `Added dependency: ${dep}@${version}`,
          dependency: dep,
          version: version,
          requiresUpdate: this.isSignificantDependency(dep)
        });
      } else if (previous.dependencies[dep] !== version) {
        changes.push({
          type: 'DEPENDENCY_UPDATED',
          severity: 'LOW',
          message: `Updated dependency: ${dep} ${previous.dependencies[dep]} → ${version}`,
          dependency: dep,
          oldVersion: previous.dependencies[dep],
          newVersion: version,
          requiresUpdate: this.isSignificantDependency(dep)
        });
      }
    }
    
    // Check removed dependencies
    for (const [dep, version] of Object.entries(previous.dependencies || {})) {
      if (!current.dependencies?.[dep]) {
        changes.push({
          type: 'DEPENDENCY_REMOVED',
          severity: 'MEDIUM',
          message: `Removed dependency: ${dep}@${version}`,
          dependency: dep,
          version: version,
          requiresUpdate: this.isSignificantDependency(dep)
        });
      }
    }
    
    return changes;
  }

  /**
   * Compare file structure between states
   */
  compareFileStructure(current, previous) {
    const changes = [];
    
    // Check for new important directories
    const importantDirs = ['pages', 'components', 'lib', 'api', 'src', 'public', 'docs'];
    
    for (const dir of importantDirs) {
      if (current.fileStructure[dir] && !previous.fileStructure?.[dir]) {
        changes.push({
          type: 'DIRECTORY_ADDED',
          severity: 'MEDIUM',
          message: `Added important directory: ${dir}/`,
          directory: dir,
          requiresUpdate: true
        });
      } else if (!current.fileStructure[dir] && previous.fileStructure?.[dir]) {
        changes.push({
          type: 'DIRECTORY_REMOVED',
          severity: 'HIGH',
          message: `Removed important directory: ${dir}/`,
          directory: dir,
          requiresUpdate: true
        });
      }
    }
    
    return changes;
  }

  /**
   * Compare tech stack between states
   */
  compareTechStack(current, previous) {
    const changes = [];
    
    const currentTech = new Set(current.techStack || []);
    const previousTech = new Set(previous.techStack || []);
    
    // Check added technologies
    for (const tech of currentTech) {
      if (!previousTech.has(tech)) {
        changes.push({
          type: 'TECH_STACK_ADDITION',
          severity: 'HIGH',
          message: `New technology added: ${tech}`,
          technology: tech,
          requiresUpdate: true
        });
      }
    }
    
    // Check removed technologies
    for (const tech of previousTech) {
      if (!currentTech.has(tech)) {
        changes.push({
          type: 'TECH_STACK_REMOVAL',
          severity: 'HIGH',
          message: `Technology removed: ${tech}`,
          technology: tech,
          requiresUpdate: true
        });
      }
    }
    
    return changes;
  }

  /**
   * Compare versions between states
   */
  compareVersions(current, previous) {
    const changes = [];
    
    if (current.packageJson?.version !== previous.packageJson?.version) {
      changes.push({
        type: 'VERSION_CHANGE',
        severity: 'MEDIUM',
        message: `Version updated: ${previous.packageJson?.version || 'unknown'} → ${current.packageJson?.version || 'unknown'}`,
        oldVersion: previous.packageJson?.version,
        newVersion: current.packageJson?.version,
        requiresUpdate: true
      });
    }
    
    return changes;
  }

  /**
   * Compare environment variables between states
   */
  compareEnvVars(current, previous) {
    const changes = [];
    
    const currentEnv = new Set(current.envVars || []);
    const previousEnv = new Set(previous.envVars || []);
    
    // Check for important new environment variables
    const importantEnvVars = ['CLAUDE_API_KEY', 'PERPLEXITY_API_KEY', 'DISCORD_BOT_TOKEN', 'DATABASE_URL', 'NEXTAUTH_SECRET'];
    
    for (const envVar of importantEnvVars) {
      if (currentEnv.has(envVar) && !previousEnv.has(envVar)) {
        changes.push({
          type: 'ENV_VAR_ADDED',
          severity: 'LOW',
          message: `Added environment variable: ${envVar}`,
          envVar: envVar,
          requiresUpdate: false // Usually don't document env vars in CLAUDE.md
        });
      }
    }
    
    return changes;
  }

  /**
   * Determine if a change requires CLAUDE.md update
   */
  requiresClaudeMdUpdate(change) {
    return change.requiresUpdate === true;
  }

  /**
   * Check if dependency is significant enough to document
   */
  isSignificantDependency(dep) {
    const significantDeps = [
      'next', 'react', 'vue', 'express', 'fastapi',
      'prisma', 'mongoose', 'sequelize',
      'tailwindcss', 'styled-components', 'chakra-ui',
      '@anthropic-ai/sdk', 'openai', 'langchain',
      'stripe', 'paypal', 'square',
      'socket.io', 'ws',
      'typescript', 'eslint', 'prettier',
      'jest', 'vitest', 'cypress',
      'docker', 'kubernetes'
    ];
    
    return significantDeps.some(sigDep => dep.includes(sigDep));
  }

  /**
   * Execute automatic CLAUDE.md update based on detected changes
   */
  async executeAutomaticUpdate(triggers) {
    if (!triggers.updateRequired || !this.claude) {
      return { updated: false, reason: 'No update required or Claude API unavailable' };
    }

    console.log(`🤖 Executing automatic CLAUDE.md update - Priority: ${triggers.priority}`);
    
    try {
      // Read current CLAUDE.md
      const currentClaudeContent = await fs.readFile(this.claudeMdPath, 'utf-8');
      
      // Generate update proposal using Claude
      const updateProposal = await this.generateUpdateProposal(triggers, currentClaudeContent);
      
      if (!updateProposal.shouldUpdate) {
        return { updated: false, reason: updateProposal.reason };
      }
      
      // Apply update
      const updatedContent = await this.applyUpdate(currentClaudeContent, updateProposal);
      
      // Create backup
      await this.createBackup(currentClaudeContent);
      
      // Write updated CLAUDE.md
      await fs.writeFile(this.claudeMdPath, updatedContent);
      
      // Log the update
      await this.logUpdate(triggers, updateProposal);
      
      console.log('✅ CLAUDE.md automatically updated');
      
      return {
        updated: true,
        proposal: updateProposal,
        changes: triggers.changes.length,
        backupCreated: true
      };
      
    } catch (error) {
      console.error('❌ Failed to execute automatic update:', error);
      return { updated: false, error: error.message };
    }
  }

  /**
   * Generate update proposal using Claude AI
   */
  async generateUpdateProposal(triggers, currentContent) {
    const prompt = `You are the Sacred CLAUDE.md Document Maintainer. Analyze the following project state changes and determine if the CLAUDE.md document needs updates.

CURRENT CLAUDE.MD EXCERPT:
\`\`\`
${currentContent.substring(0, 3000)}...
\`\`\`

DETECTED CHANGES:
${triggers.changes.map(change => `- ${change.type}: ${change.message} (Severity: ${change.severity})`).join('\n')}

ANALYSIS REQUIRED:
1. Do these changes require updating CLAUDE.md?
2. What specific sections need updates?
3. What should be added, modified, or removed?

SACRED PRINCIPLES TO MAINTAIN:
- Document accuracy must reflect current project state
- Tech stack section must be current
- Development principles remain unchanged
- Architecture descriptions must be accurate
- No removal of sacred rules or principles

Return a JSON object:
{
  "shouldUpdate": boolean,
  "reason": "explanation of decision",
  "updates": [
    {
      "section": "section name to update",
      "action": "add|modify|remove",
      "content": "new content to add or description of change",
      "justification": "why this update is needed"
    }
  ],
  "priority": "low|medium|high",
  "riskLevel": "low|medium|high"
}

Focus on maintaining document integrity while ensuring accuracy. Only suggest updates for significant changes that affect project understanding.`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 2000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Claude analysis failed:', error);
    }

    // Fallback to conservative approach
    return {
      shouldUpdate: false,
      reason: 'Unable to analyze changes automatically - manual review required'
    };
  }

  /**
   * Apply updates to CLAUDE.md content
   */
  async applyUpdate(currentContent, proposal) {
    let updatedContent = currentContent;
    
    for (const update of proposal.updates || []) {
      switch (update.action) {
        case 'modify':
          updatedContent = await this.modifySection(updatedContent, update);
          break;
        case 'add':
          updatedContent = await this.addToSection(updatedContent, update);
          break;
        case 'remove':
          updatedContent = await this.removeFromSection(updatedContent, update);
          break;
      }
    }
    
    // Update version and timestamp
    const now = new Date().toISOString().split('T')[0];
    updatedContent = updatedContent.replace(
      /\*Generated: [\d-]+\*/,
      `*Generated: ${now}*`
    );
    
    // Increment version if present
    const versionMatch = updatedContent.match(/\*Version: ([\d.]+)\*/);
    if (versionMatch) {
      const currentVersion = versionMatch[1];
      const versionParts = currentVersion.split('.').map(Number);
      versionParts[2] = (versionParts[2] || 0) + 1; // Increment patch version
      const newVersion = versionParts.join('.');
      updatedContent = updatedContent.replace(
        /\*Version: [\d.]+\*/,
        `*Version: ${newVersion}*`
      );
    }
    
    return updatedContent;
  }

  /**
   * Modify a section in CLAUDE.md
   */
  async modifySection(content, update) {
    // Implementation depends on section structure
    // This is a simplified version - real implementation would be more sophisticated
    return content;
  }

  /**
   * Add content to a section in CLAUDE.md
   */
  async addToSection(content, update) {
    if (update.section === 'Tech Stack') {
      // Find the tech stack section and add new technology
      const techStackRegex = /(### Technology Stack[\s\S]*?)((?=###)|$)/;
      const match = content.match(techStackRegex);
      
      if (match) {
        const existingSection = match[1];
        const updatedSection = existingSection + `- **${update.content}**: ${update.justification}\n`;
        return content.replace(techStackRegex, updatedSection + '$2');
      }
    }
    
    return content;
  }

  /**
   * Remove content from a section in CLAUDE.md
   */
  async removeFromSection(content, update) {
    // Conservative approach - log removal but don't auto-remove
    console.log(`⚠️ Removal suggested but not auto-applied: ${update.section} - ${update.content}`);
    return content;
  }

  /**
   * Create backup of current CLAUDE.md
   */
  async createBackup(content) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.metaDir, `claude-backup-${timestamp}.md`);
    await fs.writeFile(backupPath, content);
    
    // Keep only last 10 backups
    await this.cleanupBackups();
  }

  /**
   * Clean up old backups
   */
  async cleanupBackups() {
    try {
      const files = await fs.readdir(this.metaDir);
      const backupFiles = files
        .filter(file => file.startsWith('claude-backup-') && file.endsWith('.md'))
        .sort()
        .reverse();
      
      // Remove all but the most recent 10
      for (const file of backupFiles.slice(10)) {
        await fs.unlink(path.join(this.metaDir, file));
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Log the update for audit trail
   */
  async logUpdate(triggers, proposal) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      triggerChanges: triggers.changes.length,
      proposal: proposal,
      type: 'AUTOMATIC_UPDATE',
      success: true
    };
    
    try {
      let updateLog = [];
      if (await this.fileExists(this.updateLogFile)) {
        const logContent = await fs.readFile(this.updateLogFile, 'utf-8');
        updateLog = JSON.parse(logContent);
      }
      
      updateLog.push(logEntry);
      
      // Keep only last 100 entries
      if (updateLog.length > 100) {
        updateLog = updateLog.slice(-100);
      }
      
      await fs.writeFile(this.updateLogFile, JSON.stringify(updateLog, null, 2));
    } catch (error) {
      console.error('Failed to log update:', error);
    }
  }

  /**
   * Load previous project state
   */
  async loadPreviousState() {
    try {
      if (await this.fileExists(this.stateFile)) {
        const content = await fs.readFile(this.stateFile, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error loading previous state:', error);
    }
    return null;
  }

  /**
   * Save current project state
   */
  async saveProjectState(state) {
    try {
      await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Error saving project state:', error);
    }
  }

  /**
   * Helper functions
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  calculateChecksum(content) {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('base64')
      .substring(0, 16);
  }

  extractTechStack(packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const techStack = [];
    
    const techMapping = {
      'next': 'Next.js',
      'react': 'React',
      'vue': 'Vue.js',
      'express': 'Express',
      'fastapi': 'FastAPI',
      'prisma': 'Prisma',
      'mongoose': 'MongoDB',
      'tailwindcss': 'Tailwind CSS',
      '@anthropic-ai/sdk': 'Claude AI',
      'typescript': 'TypeScript',
      'socket.io': 'Socket.IO',
      'stripe': 'Stripe'
    };

    for (const [dep, tech] of Object.entries(techMapping)) {
      if (deps[dep]) {
        techStack.push(tech);
      }
    }

    return techStack;
  }

  async captureFileStructure() {
    const structure = {};
    const importantDirs = ['pages', 'components', 'lib', 'api', 'src', 'public', 'docs', 'tests', '__tests__'];
    
    for (const dir of importantDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      structure[dir] = await this.fileExists(dirPath);
    }
    
    return structure;
  }

  async captureEnvVarKeys() {
    const envVars = [];
    const envFile = path.join(this.projectRoot, '.env.local');
    
    try {
      if (await this.fileExists(envFile)) {
        const content = await fs.readFile(envFile, 'utf-8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          if (line.includes('=') && !line.startsWith('#')) {
            const key = line.split('=')[0].trim();
            if (key) envVars.push(key);
          }
        }
      }
    } catch (error) {
      // Ignore env file errors
    }
    
    return envVars;
  }

  async captureGitInfo() {
    // Basic git info capture - could be expanded
    return {
      hasGit: await this.fileExists(path.join(this.projectRoot, '.git')),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ClaudeAutoUpdater;