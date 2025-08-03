import { kv } from '@vercel/kv';
import { verifyAgentAuth } from '../../../../lib/security/agent-auth';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    return handleDetectConflicts(req, res);
  } else if (req.method === 'GET') {
    return handleGetConflicts(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Detect conflicts between two content versions
 */
async function handleDetectConflicts(req, res) {
  try {
    // Verify agent authentication
    const agentAuth = req.headers['x-agent-auth'];
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    const { 
      sessionId, 
      originalContent, 
      modifiedContent, 
      detectSacredViolations = true,
      conflictThreshold = 'medium' // 'low', 'medium', 'high'
    } = req.body;

    if (!sessionId || !originalContent || !modifiedContent) {
      return res.status(400).json({ 
        error: 'Missing required fields: sessionId, originalContent, modifiedContent' 
      });
    }

    // Detect various types of conflicts
    const conflicts = await detectAllConflicts(
      originalContent, 
      modifiedContent, 
      detectSacredViolations,
      conflictThreshold
    );

    // Analyze conflict severity
    const analysis = analyzeConflicts(conflicts);

    res.status(200).json({
      sessionId,
      conflicts,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Conflict detection error:', error);
    res.status(500).json({ 
      error: 'Failed to detect conflicts',
      details: error.message 
    });
  }
}

/**
 * Get existing conflicts for a merge operation
 */
async function handleGetConflicts(req, res) {
  try {
    // Verify agent authentication
    const agentAuth = req.headers['x-agent-auth'];
    if (!verifyAgentAuth.validateToken(agentAuth)) {
      return res.status(401).json({ error: 'Invalid agent authentication' });
    }

    const { mergeId, sessionId } = req.query;

    if (!mergeId && !sessionId) {
      return res.status(400).json({ 
        error: 'Either mergeId or sessionId must be provided' 
      });
    }

    let conflicts = [];
    let mergeData = null;

    if (mergeId) {
      // Get specific merge conflicts
      mergeData = await kv.get(`collaboration:merge:${mergeId}`);
      if (mergeData) {
        conflicts = mergeData.conflicts || [];
      }
    } else if (sessionId) {
      // Get current session merge conflicts
      const session = await kv.get(`collaboration:session:${sessionId}`);
      if (session && session.sessionData.merge.currentMerge) {
        mergeData = session.sessionData.merge.currentMerge;
        conflicts = mergeData.conflicts || [];
      }
    }

    if (!mergeData) {
      return res.status(404).json({ error: 'Merge data not found' });
    }

    // Enrich conflicts with resolution suggestions
    const enrichedConflicts = await enrichConflictsWithSuggestions(conflicts);

    res.status(200).json({
      mergeId: mergeData.id,
      sessionId: mergeData.sessionId,
      conflicts: enrichedConflicts,
      status: mergeData.status,
      totalConflicts: conflicts.length,
      resolvedCount: mergeData.resolvedConflicts?.length || 0,
      unresolvedCount: mergeData.unresolvedConflicts?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get conflicts error:', error);
    res.status(500).json({ 
      error: 'Failed to get conflicts',
      details: error.message 
    });
  }
}

/**
 * Detect all types of conflicts between content versions
 */
async function detectAllConflicts(originalContent, modifiedContent, detectSacredViolations, threshold) {
  const conflicts = [];
  
  // 1. Line-by-line diff conflicts
  const lineConflicts = detectLineConflicts(originalContent, modifiedContent);
  conflicts.push(...lineConflicts);
  
  // 2. Structural conflicts
  const structuralConflicts = detectStructuralConflicts(originalContent, modifiedContent);
  conflicts.push(...structuralConflicts);
  
  // 3. Sacred section violations
  if (detectSacredViolations) {
    const sacredConflicts = detectSacredViolations(originalContent, modifiedContent);
    conflicts.push(...sacredConflicts);
  }
  
  // 4. Semantic conflicts
  const semanticConflicts = detectSemanticConflicts(originalContent, modifiedContent);
  conflicts.push(...semanticConflicts);
  
  // Filter by threshold
  return filterConflictsByThreshold(conflicts, threshold);
}

/**
 * Detect line-by-line differences
 */
function detectLineConflicts(originalContent, modifiedContent) {
  const conflicts = [];
  const originalLines = originalContent.split('\n');
  const modifiedLines = modifiedContent.split('\n');
  
  const maxLines = Math.max(originalLines.length, modifiedLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[i];
    const modifiedLine = modifiedLines[i];
    
    if (originalLine !== modifiedLine) {
      const conflict = {
        id: `line_${i + 1}`,
        type: 'line_change',
        line: i + 1,
        category: 'content'
      };
      
      if (originalLine === undefined) {
        conflict.changeType = 'addition';
        conflict.content = modifiedLine;
        conflict.severity = 'low';
      } else if (modifiedLine === undefined) {
        conflict.changeType = 'deletion';
        conflict.content = originalLine;
        conflict.severity = 'medium';
      } else {
        conflict.changeType = 'modification';
        conflict.original = originalLine;
        conflict.modified = modifiedLine;
        conflict.severity = calculateLineSeverity(originalLine, modifiedLine);
      }
      
      conflicts.push(conflict);
    }
  }
  
  return conflicts;
}

/**
 * Detect structural changes (headers, sections, etc.)
 */
function detectStructuralConflicts(originalContent, modifiedContent) {
  const conflicts = [];
  
  // Extract headers
  const originalHeaders = extractHeaders(originalContent);
  const modifiedHeaders = extractHeaders(modifiedContent);
  
  // Compare header structures
  const headerChanges = compareHeaders(originalHeaders, modifiedHeaders);
  
  headerChanges.forEach((change, index) => {
    conflicts.push({
      id: `header_${index}`,
      type: 'structural_change',
      category: 'structure',
      changeType: change.type,
      severity: 'high',
      original: change.original,
      modified: change.modified,
      level: change.level
    });
  });
  
  return conflicts;
}

/**
 * Detect violations of sacred sections
 */
function detectSacredViolations(originalContent, modifiedContent) {
  const conflicts = [];
  const sacredSections = [
    'Sacred Principles',
    'ABSOLUTE RULES',
    'Deployment Target',
    'Team Account'
  ];
  
  sacredSections.forEach(section => {
    const originalSection = extractSection(originalContent, section);
    const modifiedSection = extractSection(modifiedContent, section);
    
    if (originalSection !== modifiedSection) {
      conflicts.push({
        id: `sacred_${section.toLowerCase().replace(/\s+/g, '_')}`,
        type: 'sacred_violation',
        category: 'sacred',
        changeType: 'modification',
        severity: 'critical',
        section,
        original: originalSection,
        modified: modifiedSection,
        message: `Sacred section "${section}" has been modified`
      });
    }
  });
  
  return conflicts;
}

/**
 * Detect semantic conflicts (meaning changes)
 */
function detectSemanticConflicts(originalContent, modifiedContent) {
  const conflicts = [];
  
  // Simple semantic analysis - can be enhanced with NLP
  const originalSentences = extractSentences(originalContent);
  const modifiedSentences = extractSentences(modifiedContent);
  
  // Look for significant meaning changes
  const meaningChanges = compareSentences(originalSentences, modifiedSentences);
  
  meaningChanges.forEach((change, index) => {
    if (change.significantChange) {
      conflicts.push({
        id: `semantic_${index}`,
        type: 'semantic_change',
        category: 'meaning',
        changeType: 'meaning_shift',
        severity: 'medium',
        original: change.original,
        modified: change.modified,
        confidence: change.confidence
      });
    }
  });
  
  return conflicts;
}

/**
 * Calculate severity of line changes
 */
function calculateLineSeverity(originalLine, modifiedLine) {
  // Check for sacred patterns
  if (isSacredLine(originalLine) || isSacredLine(modifiedLine)) {
    return 'critical';
  }
  
  // Check for structural patterns
  if (isStructuralLine(originalLine) || isStructuralLine(modifiedLine)) {
    return 'high';
  }
  
  // Calculate edit distance
  const editDistance = calculateEditDistance(originalLine, modifiedLine);
  const maxLength = Math.max(originalLine.length, modifiedLine.length);
  const changePercentage = editDistance / maxLength;
  
  if (changePercentage > 0.7) return 'high';
  if (changePercentage > 0.3) return 'medium';
  return 'low';
}

/**
 * Check if line contains sacred content
 */
function isSacredLine(line) {
  const sacredPatterns = [
    /^##\s+\d+\.\s+Sacred/i,
    /^\*\*ABSOLUTE RULES/i,
    /^\*\*NO SIMULATIONS/i,
    /deployment target/i,
    /team account/i
  ];
  
  return sacredPatterns.some(pattern => pattern.test(line));
}

/**
 * Check if line is structural
 */
function isStructuralLine(line) {
  return /^#{1,6}\s/.test(line) || /^\*\*[^*]+\*\*/.test(line);
}

/**
 * Calculate edit distance between strings
 */
function calculateEditDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Extract headers from content
 */
function extractHeaders(content) {
  const headers = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headers.push({
        level: match[1].length,
        text: match[2],
        line: index + 1
      });
    }
  });
  
  return headers;
}

/**
 * Compare header structures
 */
function compareHeaders(originalHeaders, modifiedHeaders) {
  const changes = [];
  
  // Simple comparison - can be enhanced with better diff algorithm
  const maxHeaders = Math.max(originalHeaders.length, modifiedHeaders.length);
  
  for (let i = 0; i < maxHeaders; i++) {
    const original = originalHeaders[i];
    const modified = modifiedHeaders[i];
    
    if (!original && modified) {
      changes.push({ type: 'addition', modified: modified.text, level: modified.level });
    } else if (original && !modified) {
      changes.push({ type: 'deletion', original: original.text, level: original.level });
    } else if (original && modified && original.text !== modified.text) {
      changes.push({ 
        type: 'modification', 
        original: original.text, 
        modified: modified.text,
        level: Math.max(original.level, modified.level)
      });
    }
  }
  
  return changes;
}

/**
 * Extract section content
 */
function extractSection(content, sectionName) {
  const regex = new RegExp(`##.*${sectionName}[\s\S]*?(?=##|$)`, 'i');
  const match = content.match(regex);
  return match ? match[0] : '';
}

/**
 * Extract sentences for semantic analysis
 */
function extractSentences(content) {
  return content.split(/[.!?]+/).filter(s => s.trim().length > 10);
}

/**
 * Compare sentences for meaning changes
 */
function compareSentences(originalSentences, modifiedSentences) {
  // Simplified semantic comparison
  const changes = [];
  
  originalSentences.forEach((original, index) => {
    const modified = modifiedSentences[index];
    if (modified && original !== modified) {
      const editDistance = calculateEditDistance(original, modified);
      const maxLength = Math.max(original.length, modified.length);
      const changePercentage = editDistance / maxLength;
      
      changes.push({
        original,
        modified,
        significantChange: changePercentage > 0.5,
        confidence: 1 - changePercentage
      });
    }
  });
  
  return changes;
}

/**
 * Filter conflicts by severity threshold
 */
function filterConflictsByThreshold(conflicts, threshold) {
  const severityOrder = ['low', 'medium', 'high', 'critical'];
  const thresholdIndex = severityOrder.indexOf(threshold);
  
  return conflicts.filter(conflict => {
    const conflictIndex = severityOrder.indexOf(conflict.severity);
    return conflictIndex >= thresholdIndex;
  });
}

/**
 * Analyze conflicts and provide summary
 */
function analyzeConflicts(conflicts) {
  const analysis = {
    totalConflicts: conflicts.length,
    severityBreakdown: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    },
    categoryBreakdown: {
      content: 0,
      structure: 0,
      sacred: 0,
      meaning: 0
    },
    recommendations: []
  };
  
  conflicts.forEach(conflict => {
    analysis.severityBreakdown[conflict.severity]++;
    analysis.categoryBreakdown[conflict.category]++;
  });
  
  // Generate recommendations
  if (analysis.severityBreakdown.critical > 0) {
    analysis.recommendations.push('Critical conflicts detected: Manual review required for sacred sections');
  }
  
  if (analysis.severityBreakdown.high > 0) {
    analysis.recommendations.push('High-severity conflicts detected: Structural changes need careful review');
  }
  
  if (analysis.categoryBreakdown.sacred > 0) {
    analysis.recommendations.push('Sacred content violations detected: These must be resolved manually');
  }
  
  return analysis;
}

/**
 * Enrich conflicts with resolution suggestions
 */
async function enrichConflictsWithSuggestions(conflicts) {
  return conflicts.map(conflict => ({
    ...conflict,
    suggestions: generateResolutionSuggestions(conflict)
  }));
}

/**
 * Generate resolution suggestions for a conflict
 */
function generateResolutionSuggestions(conflict) {
  const suggestions = [];
  
  switch (conflict.severity) {
    case 'critical':
      suggestions.push({
        action: 'manual_review',
        description: 'Manual review required - critical content affected',
        recommended: true
      });
      break;
      
    case 'high':
      suggestions.push(
        {
          action: 'accept_original',
          description: 'Keep original content (safer option)',
          recommended: true
        },
        {
          action: 'manual_review',
          description: 'Review changes manually',
          recommended: false
        }
      );
      break;
      
    case 'medium':
      suggestions.push(
        {
          action: 'accept_modified',
          description: 'Accept modified content',
          recommended: false
        },
        {
          action: 'accept_original',
          description: 'Keep original content',
          recommended: false
        },
        {
          action: 'manual_review',
          description: 'Review changes manually',
          recommended: true
        }
      );
      break;
      
    case 'low':
      suggestions.push(
        {
          action: 'accept_modified',
          description: 'Accept modified content (low risk)',
          recommended: true
        },
        {
          action: 'accept_original',
          description: 'Keep original content',
          recommended: false
        }
      );
      break;
  }
  
  return suggestions;
}