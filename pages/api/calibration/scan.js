import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { repo, includePatterns = ['*.md', 'README*', 'docs/**', 'package.json'] } = req.body;
    
    const projectRoot = process.cwd();
    const scanResults = {
      projectName: '',
      detectedTechStack: [],
      suggestedPhase: 'development',
      existingDocs: [],
      packageInfo: {},
      fileCount: 0,
      insights: {},
      cleanupSuggestions: []
    };

    // Scan for documentation files manually
    async function findFiles(dir, patterns, results = [], depth = 0) {
      if (depth > 3) return results; // Limit depth
      
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          // Skip common ignore patterns
          if (['.git', 'node_modules', '.next', 'dist', 'build'].includes(file)) continue;
          
          const fullPath = path.join(dir, file);
          const stat = await fs.stat(fullPath);
          
          if (stat.isDirectory()) {
            await findFiles(fullPath, patterns, results, depth + 1);
          } else {
            // Check if file matches any pattern
            const relativePath = path.relative(projectRoot, fullPath);
            if (file.endsWith('.md') || file.includes('README') || file === 'package.json') {
              results.push(relativePath);
            }
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
      
      return results;
    }
    
    scanResults.existingDocs = await findFiles(projectRoot, includePatterns);
    scanResults.fileCount = scanResults.existingDocs.length;

    // Analyze package.json
    try {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      scanResults.projectName = packageJson.name || '';
      scanResults.packageInfo = {
        version: packageJson.version,
        description: packageJson.description,
        scripts: Object.keys(packageJson.scripts || {}),
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {}
      };

      // Detect tech stack
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps.next) scanResults.detectedTechStack.push('Next.js');
      if (deps.react) scanResults.detectedTechStack.push('React');
      if (deps.vue) scanResults.detectedTechStack.push('Vue.js');
      if (deps.express) scanResults.detectedTechStack.push('Express');
      if (deps.fastapi) scanResults.detectedTechStack.push('FastAPI');
      if (deps.typescript) scanResults.detectedTechStack.push('TypeScript');
      if (deps.tailwindcss) scanResults.detectedTechStack.push('Tailwind CSS');
      if (deps['@anthropic-ai/sdk']) scanResults.detectedTechStack.push('Claude AI');
      if (deps.prisma) scanResults.detectedTechStack.push('Prisma');
      if (deps['@vercel/kv']) scanResults.detectedTechStack.push('Vercel KV');
      
    } catch (error) {
      console.error('Failed to read package.json:', error);
    }

    // Check for existing CLAUDE.md
    try {
      await fs.access(path.join(projectRoot, 'CLAUDE.md'));
      scanResults.hasExistingClaudeMd = true;
    } catch {
      scanResults.hasExistingClaudeMd = false;
    }

    // Analyze existing documentation
    for (const docFile of scanResults.existingDocs.slice(0, 10)) { // Limit to first 10
      try {
        const content = await fs.readFile(path.join(projectRoot, docFile), 'utf-8');
        const firstLine = content.split('\n')[0];
        
        if (docFile.toLowerCase().includes('readme')) {
          scanResults.insights.readmeFirstLine = firstLine;
        }
        
        // Look for TODO, FIXME, etc.
        const todoMatches = content.match(/TODO|FIXME|HACK|XXX/gi);
        if (todoMatches) {
          scanResults.insights.todosFound = (scanResults.insights.todosFound || 0) + todoMatches.length;
        }
      } catch (error) {
        console.error(`Failed to read ${docFile}:`, error);
      }
    }

    // Suggest cleanup based on common patterns
    const potentialCleanupFiles = [
      'README.old.md',
      'TODO.md',
      'NOTES.md',
      '.env.example',
      'test.js',
      'temp.js'
    ];

    // Check for cleanup files in root
    for (const file of potentialCleanupFiles) {
      try {
        await fs.access(path.join(projectRoot, file));
        scanResults.cleanupSuggestions.push(file);
      } catch {
        // File doesn't exist
      }
    }
    
    // Check for backup/temp directories
    const cleanupDirs = ['backup', 'temp', 'old', '_backup'];
    for (const dir of cleanupDirs) {
      try {
        const stat = await fs.stat(path.join(projectRoot, dir));
        if (stat.isDirectory()) {
          scanResults.cleanupSuggestions.push(dir + '/');
        }
      } catch {
        // Directory doesn't exist
      }
    }

    // Determine project phase based on various indicators
    if (scanResults.packageInfo.version?.includes('0.0.') || scanResults.packageInfo.version?.includes('0.1.')) {
      scanResults.suggestedPhase = 'initial-development';
    } else if (scanResults.packageInfo.version?.includes('1.')) {
      scanResults.suggestedPhase = 'production';
    } else if (scanResults.insights.todosFound > 10) {
      scanResults.suggestedPhase = 'active-development';
    }

    res.status(200).json(scanResults);

  } catch (error) {
    console.error('Repository scan error:', error);
    res.status(500).json({
      error: 'Repository scan failed',
      details: error.message
    });
  }
}