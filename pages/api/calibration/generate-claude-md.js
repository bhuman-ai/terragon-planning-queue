import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { interviewData, includeDevPrinciples, calibrationData, scanResults, timestamp } = req.body;
    
    // Support both the new format (interviewData) and legacy format (calibrationData)
    const data = interviewData || calibrationData;
    const currentTimestamp = timestamp || new Date().toISOString();
    
    // Generate the sacred CLAUDE.md content
    const claudeMdContent = await generateClaudeMd(data, scanResults, currentTimestamp, includeDevPrinciples);
    
    // Analyze for cleanup suggestions
    const cleanupSuggestions = await analyzeForCleanup(data, scanResults);
    
    res.status(200).json({
      claudeMarkdown: claudeMdContent, // New expected format
      content: claudeMdContent, // Legacy support
      suggestedCleanup: cleanupSuggestions
    });

  } catch (error) {
    console.error('Generate CLAUDE.md error:', error);
    res.status(500).json({
      error: 'Failed to generate CLAUDE.md',
      details: error.message
    });
  }
}

async function generateClaudeMd(data, scanResults, timestamp, includeDevPrinciples = false) {
  const techStack = data.techStack || scanResults?.detectedTechStack || [];
  
  // Read the D3 CLAUDE.md and dev.md to extract core principles if requested
  let d3Principles = '';
  let devPrinciples = '';
  
  if (includeDevPrinciples) {
    try {
      const d3ClaudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
      const d3ClaudeMdContent = await fs.readFile(d3ClaudeMdPath, 'utf-8');
      
      // Extract the Sacred Principles section
      const principlesMatch = d3ClaudeMdContent.match(/## 3\. Coding Standards & AI Instructions[\s\S]*?(?=## 4\.|$)/);
      if (principlesMatch) {
        d3Principles = principlesMatch[0];
      }
    } catch (error) {
      console.log('Could not read D3 CLAUDE.md for principles');
    }

    try {
      const devMdPath = path.join(process.cwd(), 'public', 'dev.md');
      const devMdContent = await fs.readFile(devMdPath, 'utf-8');
      devPrinciples = devMdContent;
    } catch (error) {
      console.log('Could not read dev.md for universal principles');
    }
  }
  
  return `# ${data.projectName || 'PROJECT'} - Sacred Source of Truth 🔥

> **IMPORTANT**: This is the HOLY SACRED source of truth for this project. ALL decisions must align with this document.
> Any code, feature, or decision that contradicts this document should be rejected.

**Document Status**: ACTIVE
**Created**: ${timestamp}
**Last Updated**: ${timestamp}
**Last Verified**: ${timestamp}
**Confidence Level**: HIGH

## 1. Sacred Project Foundation

### Vision & Purpose
**Vision**: ${data.vision || 'To be defined'}

**Target Users**: ${data.target_users || data.userbase || 'To be defined'}

**Core Problem**: ${data.core_problem || 'Extracted from vision'}

**Success Metrics**:
${data.success_metrics || '- To be defined\n- Measure impact'}

### Current Phase
**Phase**: ${data.currentPhase || scanResults?.suggestedPhase || 'development'}
**Version**: ${scanResults?.packageInfo?.version || '0.0.1'}

## 2. Technical Architecture (Immutable Decisions)

### Tech Stack
${techStack.map(tech => `- ${tech}`).join('\n')}

### Architecture Pattern
**Pattern**: ${data.architecture_pattern || 'Modular Monolith'}
**Rationale**: ${data.architecture_rationale || 'Based on team size and scaling needs'}

### Database Strategy
**Approach**: ${data.database_strategy || 'PostgreSQL with Prisma ORM'}
**Schema Evolution**: ${data.schema_evolution || 'Backwards compatible migrations only'}

### State Management
**Frontend**: ${data.state_management || 'Context API for global state'}
**Backend**: ${data.backend_state || 'Stateless with external stores'}

## 3. Infrastructure & Deployment

### Deployment Target
**Primary**: ${Array.isArray(data.deployment_target) ? data.deployment_target[0] : data.deployment_target || 'Vercel'}
**Secondary**: ${Array.isArray(data.deployment_target) && data.deployment_target[1] || 'None'}

### CI/CD Pipeline
**Deployment Frequency**: ${data.deployment_frequency || 'On every main branch commit'}
**Rollback Strategy**: Automated rollback on health check failure

### Monitoring & Observability
- Error tracking: Sentry
- Performance monitoring: Vercel Analytics
- Uptime monitoring: Required 99.9%

## 4. Security Requirements (Non-Negotiable)

${data.security_requirements ? (Array.isArray(data.security_requirements) 
  ? data.security_requirements.map(req => `- ${req}`).join('\n')
  : `- ${data.security_requirements}`) 
  : '- Input validation on all endpoints\n- Authentication required for all mutations\n- Rate limiting on all APIs'}

### Authentication Strategy
- Method: ${data.auth_method || 'JWT with refresh tokens'}
- Session duration: ${data.session_duration || '7 days'}
- MFA: ${data.mfa_required || 'Required for admin accounts'}

## 5. Performance Targets (Enforced)

${data.performance_targets || `- API Response time: <200ms p95
- Page load time: <3s on 3G
- Time to interactive: <5s
- Lighthouse score: >90`}

### Optimization Priorities
1. User-perceived performance
2. Database query efficiency  
3. Bundle size optimization
4. Caching strategy

## 6. Development Standards (Enforced by CI)

### Universal Development Principles
${devPrinciples ? `${devPrinciples}\n\n### Project-Specific Standards` : '### Coding Principles'}
${data.coding_principles || `- No any types in TypeScript
- No magic numbers or strings
- All functions must have single responsibility
- Comments explain WHY, not WHAT
- Test coverage minimum: 80%`}

${d3Principles ? `\n### Meta-Agent Context Standards\n${d3Principles.replace(/^## 3\. Coding Standards & AI Instructions\n?/m, '')}` : ''}

### Code Review Requirements
- All code must be reviewed before merge
- Tests must pass
- No decrease in test coverage
- Must follow established patterns

### Git Workflow
- Branch naming: feature/*, bugfix/*, hotfix/*
- Commit messages: Conventional commits
- PR template required
- Squash merge only

## 7. Team & Workflow

### Team Structure
**Current Size**: ${data.team_size || 'Solo developer'}
**Target Size**: ${data.target_team_size || 'Same'}

### Communication
- Async-first communication
- Document all decisions
- Weekly sync meetings

### Decision Making
- Technical decisions: Team consensus
- Product decisions: Product owner
- Emergency decisions: On-call developer

## 8. Error Handling Strategy

${data.error_strategy ? (Array.isArray(data.error_strategy)
  ? data.error_strategy.map(strategy => `- ${strategy}`).join('\n')
  : `- ${data.error_strategy}`)
  : '- User-friendly error messages\n- Comprehensive logging\n- Graceful degradation'}

## 9. Third-Party Integrations

${data.third_party_integrations || 'None currently. All integrations must be approved.'}

## 10. Constraints & Boundaries

### Business Constraints
${data.business_constraints || '- Budget: To be defined\n- Timeline: Ongoing\n- Compliance: Standard web application'}

### Technical Boundaries  
- No external dependencies without approval
- All APIs must be versioned
- Breaking changes require migration plan

## 11. Future Roadmap

### Scaling Expectations (12 months)
${data.scaling_expectations || '- Users: 10K MAU\n- Data: <1TB\n- Requests: 100K/day'}

### Planned Features
- Phase 1: Core functionality
- Phase 2: Enhanced features
- Phase 3: Scale optimizations

## 12. Sacred Rules (NEVER VIOLATE)

1. **Documentation First**: Document before implementing
2. **Security First**: Never compromise security for features
3. **User First**: Every decision must benefit users
4. **Quality First**: No shortcuts on code quality
5. **Data First**: Protect user data at all costs

## 13. Living Document Sections

### Change Log
- ${timestamp}: Initial calibration completed

### Verification History
- ${timestamp}: Document created and verified

### Confidence Levels
- Architecture: HIGH
- Security: HIGH  
- Performance: MEDIUM
- Scaling: MEDIUM

---

**⚠️ ENFORCEMENT**: Any code that violates this document will be rejected. The CI/CD pipeline enforces these standards automatically.

**📝 UPDATES**: This document can only be updated through the calibration process. All changes must be approved and tracked.

**🔒 PROTECTION**: This file is protected. Manual edits will trigger alerts.`;
}

async function analyzeForCleanup(calibrationData, scanResults) {
  const suggestions = [...(scanResults?.cleanupSuggestions || [])];
  
  // Add intelligent suggestions based on calibration
  if (calibrationData.currentPhase === 'production') {
    suggestions.push(
      '*.test.js', // Test files in root
      'TODO.md',
      'NOTES.md',
      'old/**',
      'backup/**',
      'temp/**'
    );
  }
  
  // Remove duplicates
  return [...new Set(suggestions)];
}