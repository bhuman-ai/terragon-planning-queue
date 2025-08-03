import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      markdown,
      content,
      reviewNotes,
      interviewData,
      repository,
      author
    } = req.body;

    // Support both markdown and content parameters
    const claudeContent = markdown || content;

    if (!claudeContent) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const projectRoot = process.cwd();
    const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
    const historyDir = path.join(projectRoot, '.claude', 'history');

    // Create history directory if it doesn't exist
    await fs.mkdir(historyDir, { recursive: true });

    // Check if CLAUDE.md already exists (for versioning)
    let existingContent = null;
    try {
      existingContent = await fs.readFile(claudeMdPath, 'utf-8');
    } catch (error) {
      // File doesn't exist yet, which is fine
    }

    // If file exists, create a backup
    if (existingContent) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(historyDir, `CLAUDE-${timestamp}.md`);
      await fs.writeFile(backupPath, existingContent);
    }

    // Write the new CLAUDE.md
    await fs.writeFile(claudeMdPath, claudeContent);

    // Save version to version control system if repository is provided
    let versionInfo = null;
    if (repository) {
      try {
        const versionResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3001'}/api/calibration/claude-md-versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repo: repository,
            content: claudeContent,
            changelog: existingContent ? 'CLAUDE.md updated via calibration' : 'Initial CLAUDE.md creation',
            author: author || 'Calibration Wizard',
            reviewNotes: reviewNotes || '',
            confidence: {
              architecture: 'HIGH',
              security: 'HIGH',
              performance: 'MEDIUM',
              scaling: 'MEDIUM'
            },
            interviewData,
            previousVersionId: existingContent ? 'previous' : null
          })
        });

        if (versionResponse.ok) {
          versionInfo = await versionResponse.json();
        }
      } catch (versionError) {
        console.error('Failed to save version:', versionError);
        // Continue with regular save even if versioning fails
      }
    }

    // Create or update .claude/meta.json
    const metaPath = path.join(projectRoot, '.claude', 'meta.json');
    const meta = {
      created: existingContent ? undefined : new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      lastVerified: new Date().toISOString(),
      version: existingContent ? 'updated' : 'initial',
      status: 'ACTIVE',
      checksum: Buffer.from(claudeContent).toString('base64').substring(0, 16),
      versionInfo
    };

    // Preserve creation date if updating
    try {
      const existingMeta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      meta.created = existingMeta.created;
      meta.version = `v${parseInt(existingMeta.version.substring(1) || '1') + 1}`;
    } catch (error) {
      meta.created = meta.lastUpdated;
      meta.version = 'v1';
    }

    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

    // Create integrity check file
    const integrityPath = path.join(projectRoot, '.claude', 'integrity.json');
    const integrity = {
      lastCheck: new Date().toISOString(),
      status: 'VALID',
      claudeMdChecksum: meta.checksum,
      enforcementEnabled: true,
      protectionLevel: 'HIGH'
    };
    await fs.writeFile(integrityPath, JSON.stringify(integrity, null, 2));

    // Try to commit to git (optional, may fail if not in git repo)
    try {
      await execAsync('git add CLAUDE.md .claude/');
      await execAsync(`git commit -m "🔥 Sacred calibration: ${existingContent ? 'Update' : 'Initialize'} CLAUDE.md

This is the holy source of truth for the project.
Version: ${meta.version}
Status: ACTIVE

Co-Authored-By: Calibration Wizard <calibration@sacred.bot>"`);
    } catch (gitError) {
      console.log('Git commit skipped:', gitError.message);
    }

    res.status(200).json({
      success: true,
      path: claudeMdPath,
      meta,
      versionInfo,
      message: existingContent
        ? 'CLAUDE.md updated successfully. Previous version backed up.'
        : 'CLAUDE.md created successfully. This is now your sacred source of truth.',
      versionControlMessage: versionInfo
        ? `Version ${versionInfo.versionId} saved to version control`
        : 'Version control not available'
    });

  } catch (error) {
    console.error('Save CLAUDE.md error:', error);
    res.status(500).json({
      error: 'Failed to save CLAUDE.md',
      details: error.message
    });
  }
}
