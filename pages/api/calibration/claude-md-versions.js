/**
 * CLAUDE.md Version Control System
 * Tracks all changes to the sacred document with full history
 */

import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return getVersionHistory(req, res);
  } else if (req.method === 'POST') {
    return saveVersion(req, res);
  } else if (req.method === 'PUT') {
    return compareVersions(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Get version history for a repository
async function getVersionHistory(req, res) {
  try {
    const { repo } = req.query;
    
    if (!repo) {
      return res.status(400).json({ error: 'Repository parameter required' });
    }
    
    const versionsPath = path.join(process.cwd(), '.claude-versions', repo.replace('/', '_'));
    
    try {
      const versions = await fs.readdir(versionsPath);
      const versionDetails = [];
      
      for (const versionFile of versions.filter(f => f.endsWith('.json'))) {
        const versionPath = path.join(versionsPath, versionFile);
        const versionData = JSON.parse(await fs.readFile(versionPath, 'utf-8'));
        versionDetails.push(versionData);
      }
      
      // Sort by timestamp, newest first
      versionDetails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      res.status(200).json({
        repository: repo,
        totalVersions: versionDetails.length,
        versions: versionDetails
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // No versions yet
        res.status(200).json({
          repository: repo,
          totalVersions: 0,
          versions: []
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('Get version history error:', error);
    res.status(500).json({
      error: 'Failed to get version history',
      details: error.message
    });
  }
}

// Save a new version of CLAUDE.md
async function saveVersion(req, res) {
  try {
    const { 
      repo, 
      content, 
      changelog, 
      author, 
      reviewNotes,
      confidence,
      interviewData,
      previousVersionId 
    } = req.body;
    
    if (!repo || !content) {
      return res.status(400).json({ error: 'Repository and content required' });
    }
    
    const versionsDir = path.join(process.cwd(), '.claude-versions', repo.replace('/', '_'));
    await fs.mkdir(versionsDir, { recursive: true });
    
    // Generate version ID
    const timestamp = new Date().toISOString();
    const versionId = `v${Date.now()}`;
    
    // Calculate content hash for integrity
    const contentHash = await generateContentHash(content);
    
    // Detect changes from previous version
    let changesDetected = [];
    if (previousVersionId) {
      changesDetected = await detectChanges(versionsDir, previousVersionId, content);
    }
    
    const versionData = {
      id: versionId,
      timestamp,
      repository: repo,
      author: author || 'System',
      content,
      contentHash,
      changelog: changelog || 'CLAUDE.md updated via calibration',
      reviewNotes: reviewNotes || '',
      confidence: confidence || {
        architecture: 'HIGH',
        security: 'HIGH',
        performance: 'MEDIUM',
        scaling: 'MEDIUM'
      },
      interviewData: interviewData || null,
      previousVersionId: previousVersionId || null,
      changesDetected,
      stats: {
        contentLength: content.length,
        sectionsCount: (content.match(/^##\s/gm) || []).length,
        todoItems: (content.match(/- \[ \]/g) || []).length,
        completedItems: (content.match(/- \[x\]/g) || []).length
      }
    };
    
    // Save version file
    const versionFile = path.join(versionsDir, `${versionId}.json`);
    await fs.writeFile(versionFile, JSON.stringify(versionData, null, 2));
    
    // Update latest version pointer
    const latestFile = path.join(versionsDir, 'latest.json');
    await fs.writeFile(latestFile, JSON.stringify({
      latestVersionId: versionId,
      timestamp,
      repository: repo
    }, null, 2));
    
    res.status(200).json({
      success: true,
      versionId,
      timestamp,
      contentHash,
      changesDetected: changesDetected.length,
      message: 'Version saved successfully'
    });
    
  } catch (error) {
    console.error('Save version error:', error);
    res.status(500).json({
      error: 'Failed to save version',
      details: error.message
    });
  }
}

// Compare two versions
async function compareVersions(req, res) {
  try {
    const { repo, versionA, versionB } = req.body;
    
    if (!repo || !versionA || !versionB) {
      return res.status(400).json({ error: 'Repository and both version IDs required' });
    }
    
    const versionsDir = path.join(process.cwd(), '.claude-versions', repo.replace('/', '_'));
    
    const versionAPath = path.join(versionsDir, `${versionA}.json`);
    const versionBPath = path.join(versionsDir, `${versionB}.json`);
    
    const versionAData = JSON.parse(await fs.readFile(versionAPath, 'utf-8'));
    const versionBData = JSON.parse(await fs.readFile(versionBPath, 'utf-8'));
    
    const comparison = {
      versionA: {
        id: versionAData.id,
        timestamp: versionAData.timestamp,
        author: versionAData.author,
        contentLength: versionAData.stats.contentLength
      },
      versionB: {
        id: versionBData.id,
        timestamp: versionBData.timestamp,
        author: versionBData.author,
        contentLength: versionBData.stats.contentLength
      },
      differences: await generateDiff(versionAData.content, versionBData.content),
      confidenceChanges: compareConfidence(versionAData.confidence, versionBData.confidence),
      statsComparison: compareStats(versionAData.stats, versionBData.stats)
    };
    
    res.status(200).json(comparison);
    
  } catch (error) {
    console.error('Compare versions error:', error);
    res.status(500).json({
      error: 'Failed to compare versions',
      details: error.message
    });
  }
}

// Generate a simple content hash
async function generateContentHash(content) {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// Detect changes between versions
async function detectChanges(versionsDir, previousVersionId, newContent) {
  try {
    const previousPath = path.join(versionsDir, `${previousVersionId}.json`);
    const previousData = JSON.parse(await fs.readFile(previousPath, 'utf-8'));
    const previousContent = previousData.content;
    
    const changes = [];
    
    // Simple change detection
    const oldLines = previousContent.split('\n');
    const newLines = newContent.split('\n');
    
    // Check for section additions/removals
    const oldSections = oldLines.filter(line => line.startsWith('##'));
    const newSections = newLines.filter(line => line.startsWith('##'));
    
    for (const section of newSections) {
      if (!oldSections.includes(section)) {
        changes.push({
          type: 'section_added',
          content: section,
          description: `Added section: ${section}`
        });
      }
    }
    
    for (const section of oldSections) {
      if (!newSections.includes(section)) {
        changes.push({
          type: 'section_removed',
          content: section,
          description: `Removed section: ${section}`
        });
      }
    }
    
    // Check for significant content changes
    const contentLengthDiff = Math.abs(newContent.length - previousContent.length);
    if (contentLengthDiff > 100) {
      changes.push({
        type: 'content_length_change',
        content: `${contentLengthDiff} characters`,
        description: `Content length changed by ${contentLengthDiff} characters`
      });
    }
    
    return changes;
    
  } catch (error) {
    console.error('Error detecting changes:', error);
    return [{
      type: 'detection_error',
      content: 'Unable to detect changes',
      description: 'Previous version comparison failed'
    }];
  }
}

// Generate simple diff between two texts
async function generateDiff(textA, textB) {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  
  const additions = [];
  const deletions = [];
  const modifications = [];
  
  // Simple line-by-line comparison
  const maxLines = Math.max(linesA.length, linesB.length);
  
  for (let i = 0; i < maxLines; i++) {
    const lineA = linesA[i] || '';
    const lineB = linesB[i] || '';
    
    if (lineA && !lineB) {
      deletions.push({ line: i + 1, content: lineA });
    } else if (!lineA && lineB) {
      additions.push({ line: i + 1, content: lineB });
    } else if (lineA !== lineB && lineA && lineB) {
      modifications.push({ 
        line: i + 1, 
        old: lineA, 
        new: lineB 
      });
    }
  }
  
  return {
    additions: additions.slice(0, 10), // Limit output
    deletions: deletions.slice(0, 10),
    modifications: modifications.slice(0, 10),
    summary: {
      addedLines: additions.length,
      deletedLines: deletions.length,
      modifiedLines: modifications.length
    }
  };
}

// Compare confidence levels between versions
function compareConfidence(oldConf, newConf) {
  const changes = {};
  
  for (const key in newConf) {
    if (oldConf[key] !== newConf[key]) {
      changes[key] = {
        from: oldConf[key],
        to: newConf[key]
      };
    }
  }
  
  return changes;
}

// Compare stats between versions
function compareStats(oldStats, newStats) {
  const changes = {};
  
  for (const key in newStats) {
    if (oldStats[key] !== newStats[key]) {
      changes[key] = {
        from: oldStats[key],
        to: newStats[key],
        delta: newStats[key] - (oldStats[key] || 0)
      };
    }
  }
  
  return changes;
}