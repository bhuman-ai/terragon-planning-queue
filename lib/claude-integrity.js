import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import SecuritySystem from './security/index.js';

class ClaudeIntegrityChecker {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
    this.metaPath = path.join(projectRoot, '.claude', 'meta.json');
    this.integrityPath = path.join(projectRoot, '.claude', 'integrity.json');
    
    // Initialize security system integration
    this.securitySystem = new SecuritySystem(projectRoot);
    this.securityEnabled = false;
  }

  /**
   * Enable enhanced security mode
   */
  async enableSecurity() {
    try {
      if (!this.securityEnabled) {
        await this.securitySystem.initialize();
        this.securityEnabled = true;
        console.log('✅ Enhanced security mode enabled for CLAUDE.md integrity');
      }
      return { success: true, securityEnabled: true };
    } catch (error) {
      console.warn('⚠️ Could not enable enhanced security:', error.message);
      return { success: false, securityEnabled: false, error: error.message };
    }
  }

  /**
   * Check if CLAUDE.md exists and is valid
   * Enhanced with Phase 2A security controls
   */
  async checkIntegrity() {
    try {
      // Try to enable enhanced security mode
      await this.enableSecurity();

      // Check if CLAUDE.md exists
      const claudeMdContent = await fs.readFile(this.claudeMdPath, 'utf-8');
      
      let enhancedVerification = null;
      
      // Use enhanced security verification if available
      if (this.securityEnabled) {
        try {
          enhancedVerification = await this.securitySystem.verifySacredDocument(this.claudeMdPath);
          
          if (enhancedVerification.sacred && !enhancedVerification.verified) {
            return {
              valid: false,
              exists: true,
              enhanced: true,
              securityBreach: true,
              verification: enhancedVerification,
              message: '🚨 CRITICAL SECURITY BREACH: CLAUDE.md has been tampered with! Enhanced security detected unauthorized modifications.'
            };
          }
        } catch (secError) {
          console.warn('Enhanced security check failed, falling back to basic integrity:', secError.message);
        }
      }
      
      // Legacy integrity check (fallback)
      let legacyResult = null;
      try {
        // Check if meta files exist
        const meta = JSON.parse(await fs.readFile(this.metaPath, 'utf-8'));
        const integrity = JSON.parse(await fs.readFile(this.integrityPath, 'utf-8'));
        
        // Calculate current checksum
        const currentChecksum = this.calculateChecksum(claudeMdContent);
        
        // Compare with stored checksum
        const isValid = currentChecksum === meta.checksum;
        
        // Update integrity status
        integrity.lastCheck = new Date().toISOString();
        integrity.status = isValid ? 'VALID' : 'TAMPERED';
        integrity.claudeMdChecksum = currentChecksum;
        
        await fs.writeFile(this.integrityPath, JSON.stringify(integrity, null, 2));
        
        legacyResult = {
          valid: isValid,
          exists: true,
          meta,
          integrity,
          message: isValid 
            ? 'CLAUDE.md is intact and valid' 
            : '⚠️ CLAUDE.md has been modified outside of calibration process!'
        };
      } catch (legacyError) {
        // Legacy system not set up yet
        legacyResult = {
          valid: true, // Assume valid if no legacy system
          exists: true,
          meta: null,
          integrity: null,
          message: 'Legacy integrity system not initialized - relying on enhanced security'
        };
      }

      // Combine results
      const result = {
        ...legacyResult,
        enhanced: this.securityEnabled,
        enhancedVerification,
        securityLevel: this.securityEnabled ? 'ENHANCED' : 'BASIC',
        recommendation: this.securityEnabled ? 
          'Sacred document protection active' : 
          'Consider enabling enhanced security for maximum protection'
      };

      // If enhanced security detected issues, override legacy result
      if (enhancedVerification?.sacred && !enhancedVerification?.verified) {
        result.valid = false;
        result.securityBreach = true;
        result.message = '🚨 ENHANCED SECURITY ALERT: Sacred document integrity compromised!';
      }

      return result;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          valid: false,
          exists: false,
          enhanced: this.securityEnabled,
          message: 'CLAUDE.md does not exist. Calibration required.'
        };
      }
      throw error;
    }
  }

  /**
   * Calculate checksum for content
   */
  calculateChecksum(content) {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('base64')
      .substring(0, 16);
  }

  /**
   * Detect drift between CLAUDE.md and actual project state
   */
  async detectDrift() {
    const driftReport = {
      timestamp: new Date().toISOString(),
      drifts: [],
      warnings: [],
      suggestions: []
    };

    try {
      const claudeMdContent = await fs.readFile(this.claudeMdPath, 'utf-8');
      
      // Parse tech stack from CLAUDE.md
      const techStackMatch = claudeMdContent.match(/### Tech Stack\n([\s\S]*?)\n\n/);
      const documentedTechStack = techStackMatch 
        ? techStackMatch[1].split('\n').map(line => line.replace('- ', '').trim()).filter(Boolean)
        : [];

      // Check actual package.json
      const packageJson = JSON.parse(
        await fs.readFile(path.join(this.projectRoot, 'package.json'), 'utf-8')
      );
      
      const actualDeps = Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      });

      // Detect new dependencies not in CLAUDE.md
      const techMapping = {
        'next': 'Next.js',
        'react': 'React',
        'vue': 'Vue.js',
        'express': 'Express',
        '@anthropic-ai/sdk': 'Claude AI',
        'typescript': 'TypeScript',
        'tailwindcss': 'Tailwind CSS',
        'prisma': 'Prisma'
      };

      for (const [dep, techName] of Object.entries(techMapping)) {
        if (actualDeps.includes(dep) && !documentedTechStack.includes(techName)) {
          driftReport.drifts.push({
            type: 'TECH_STACK_DRIFT',
            severity: 'HIGH',
            message: `${techName} is used but not documented in CLAUDE.md`,
            suggestion: `Update CLAUDE.md Tech Stack section to include ${techName}`
          });
        }
      }

      // Check for version drift
      const versionMatch = claudeMdContent.match(/\*\*Version\*\*: ([\d.]+)/);
      const documentedVersion = versionMatch ? versionMatch[1] : null;
      
      if (documentedVersion && packageJson.version !== documentedVersion) {
        driftReport.warnings.push({
          type: 'VERSION_DRIFT',
          severity: 'MEDIUM',
          message: `Package version (${packageJson.version}) differs from CLAUDE.md (${documentedVersion})`,
          suggestion: 'Update CLAUDE.md with current version'
        });
      }

      // Check for security requirements
      if (claudeMdContent.includes('GDPR compliance') && !actualDeps.includes('cookie-consent')) {
        driftReport.suggestions.push({
          type: 'SECURITY_REQUIREMENT',
          severity: 'HIGH',
          message: 'GDPR compliance mentioned but no cookie consent library found',
          suggestion: 'Implement cookie consent to meet GDPR requirements'
        });
      }

      // Check deployment target
      if (claudeMdContent.includes('Primary**: Vercel')) {
        const hasVercelConfig = await this.fileExists(path.join(this.projectRoot, 'vercel.json'));
        if (!hasVercelConfig) {
          driftReport.warnings.push({
            type: 'DEPLOYMENT_CONFIG',
            severity: 'LOW',
            message: 'Vercel deployment mentioned but vercel.json not found',
            suggestion: 'Add vercel.json for deployment configuration'
          });
        }
      }

      // Check for test coverage requirement
      const coverageMatch = claudeMdContent.match(/Test coverage minimum: (\d+)%/);
      if (coverageMatch) {
        const requiredCoverage = parseInt(coverageMatch[1]);
        // Check if jest config exists
        const hasJestConfig = packageJson.jest || await this.fileExists(path.join(this.projectRoot, 'jest.config.js'));
        if (!hasJestConfig) {
          driftReport.drifts.push({
            type: 'TEST_SETUP',
            severity: 'HIGH',
            message: `Test coverage requirement (${requiredCoverage}%) but no test framework configured`,
            suggestion: 'Set up Jest or another test framework'
          });
        }
      }

      driftReport.summary = {
        totalDrifts: driftReport.drifts.length,
        totalWarnings: driftReport.warnings.length,
        totalSuggestions: driftReport.suggestions.length,
        status: driftReport.drifts.length === 0 ? 'ALIGNED' : 'DRIFT_DETECTED'
      };

    } catch (error) {
      driftReport.error = error.message;
      driftReport.summary = { status: 'ERROR' };
    }

    return driftReport;
  }

  /**
   * Helper to check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Enforce CLAUDE.md rules for a given task or code change
   */
  async enforceRules(proposedChange) {
    const enforcement = {
      allowed: true,
      violations: [],
      warnings: []
    };

    try {
      const claudeMdContent = await fs.readFile(this.claudeMdPath, 'utf-8');
      
      // Check sacred rules
      const sacredRulesMatch = claudeMdContent.match(/## \d+\. Sacred Rules[\s\S]*?(?=##|$)/);
      if (sacredRulesMatch) {
        const rules = sacredRulesMatch[0].split('\n').filter(line => line.match(/^\d+\./));
        
        // Check for documentation first rule
        if (proposedChange.type === 'feature' && !proposedChange.hasDocumentation) {
          enforcement.violations.push({
            rule: 'Documentation First',
            message: 'Features must be documented before implementation',
            severity: 'BLOCKING'
          });
          enforcement.allowed = false;
        }
        
        // Check security first rule
        if (proposedChange.skipsSecurity) {
          enforcement.violations.push({
            rule: 'Security First',
            message: 'Security cannot be compromised for features',
            severity: 'BLOCKING'
          });
          enforcement.allowed = false;
        }
      }

      // Check coding standards
      if (proposedChange.code) {
        // No any types
        if (claudeMdContent.includes('No any types') && proposedChange.code.includes(': any')) {
          enforcement.violations.push({
            rule: 'No any types',
            message: 'TypeScript any type is forbidden',
            severity: 'BLOCKING'
          });
          enforcement.allowed = false;
        }
        
        // No magic numbers
        if (claudeMdContent.includes('No magic numbers') && /\b\d{2,}\b/.test(proposedChange.code)) {
          enforcement.warnings.push({
            rule: 'No magic numbers',
            message: 'Consider extracting magic numbers to constants',
            severity: 'WARNING'
          });
        }
      }

    } catch (error) {
      enforcement.error = error.message;
      enforcement.allowed = false;
      enforcement.violations.push({
        rule: 'CLAUDE.md Access',
        message: 'Cannot validate without CLAUDE.md',
        severity: 'BLOCKING'
      });
    }

    return enforcement;
  }
}

// Export validation function for collaboration system
export function validateClaudemdContent(content) {
  // Basic validation - check for sacred principles
  const sacredPrinciples = [
    'NO SIMULATIONS',
    'NO FALLBACKS', 
    'NO TEMPLATES',
    'NO ASSUMPTIONS',
    'ALWAYS REAL'
  ];
  
  // Ensure content contains sacred principles
  const hasSacredPrinciples = sacredPrinciples.some(principle => 
    content.includes(principle)
  );
  
  if (!hasSacredPrinciples) {
    return {
      valid: false,
      error: 'Content missing sacred principles'
    };
  }
  
  return { valid: true };
}

export default ClaudeIntegrityChecker;