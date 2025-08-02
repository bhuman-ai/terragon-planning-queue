import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'Files array is required' });
    }

    const projectRoot = process.cwd();
    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    // Process each file for cleanup
    for (const file of files) {
      // Security check - prevent path traversal
      const normalizedPath = path.normalize(file);
      if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
        results.skipped.push({
          file,
          reason: 'Invalid path'
        });
        continue;
      }

      // Don't allow deletion of critical files
      const criticalFiles = [
        'package.json',
        'package-lock.json',
        'yarn.lock',
        '.git',
        '.gitignore',
        'CLAUDE.md',
        '.claude'
      ];
      
      if (criticalFiles.some(critical => normalizedPath.includes(critical))) {
        results.skipped.push({
          file,
          reason: 'Critical file'
        });
        continue;
      }

      const fullPath = path.join(projectRoot, normalizedPath);
      
      try {
        // Check if it's a directory
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          // Remove directory and all contents
          await fs.rm(fullPath, { recursive: true, force: true });
          results.success.push({
            file,
            type: 'directory'
          });
        } else {
          // Remove file
          await fs.unlink(fullPath);
          results.success.push({
            file,
            type: 'file'
          });
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          results.skipped.push({
            file,
            reason: 'File not found'
          });
        } else {
          results.failed.push({
            file,
            error: error.message
          });
        }
      }
    }

    // Log cleanup action
    const cleanupLog = {
      timestamp: new Date().toISOString(),
      requestedFiles: files.length,
      results
    };
    
    try {
      const logPath = path.join(projectRoot, '.claude', 'cleanup.log');
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      
      let existingLog = [];
      try {
        const logContent = await fs.readFile(logPath, 'utf-8');
        existingLog = JSON.parse(logContent);
      } catch {
        // No existing log
      }
      
      existingLog.push(cleanupLog);
      await fs.writeFile(logPath, JSON.stringify(existingLog, null, 2));
    } catch (error) {
      console.error('Failed to write cleanup log:', error);
    }

    res.status(200).json({
      success: true,
      message: `Cleanup complete: ${results.success.length} removed, ${results.failed.length} failed, ${results.skipped.length} skipped`,
      results
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      error: 'Cleanup failed',
      details: error.message
    });
  }
}