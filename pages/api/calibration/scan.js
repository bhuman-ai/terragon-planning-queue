import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { repo, includePatterns = ['*.md', 'README*', 'docs/**', 'package.json'] } = req.body;
    
    if (!repo || !repo.includes('/')) {
      return res.status(400).json({ error: 'Invalid repository format. Expected: owner/repo' });
    }
    
    const [owner, repoName] = repo.split('/');
    const scanResults = {
      projectName: repoName,
      detectedTechStack: [],
      suggestedPhase: 'development',
      existingDocs: [],
      packageInfo: {},
      fileCount: 0,
      insights: {},
      cleanupSuggestions: [],
      repository: repo
    };

    // Use GitHub API to scan repository
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Terragon-Planning-Queue'
    };
    
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    
    // Function to recursively scan GitHub repository
    async function scanGitHubDirectory(path = '') {
      const results = [];
      
      try {
        const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          console.error(`Failed to scan ${path}: ${response.status}`);
          return results;
        }
        
        const items = await response.json();
        
        // Process items in parallel but limit concurrency
        const BATCH_SIZE = 5;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE);
          
          await Promise.all(batch.map(async (item) => {
            // Skip common ignore patterns
            if (['.git', 'node_modules', '.next', 'dist', 'build', '__pycache__', '.pytest_cache'].includes(item.name)) {
              return;
            }
            
            if (item.type === 'file') {
              // Include various documentation and config files
              const fileName = item.name.toLowerCase();
              const filePath = item.path;
              
              if (fileName.endsWith('.md') || 
                  fileName.includes('readme') ||
                  fileName === 'package.json' ||
                  fileName === 'requirements.txt' ||
                  fileName === 'setup.py' ||
                  fileName === 'pyproject.toml' ||
                  fileName === 'cargo.toml' ||
                  fileName === 'go.mod' ||
                  fileName === 'composer.json' ||
                  fileName === 'gemfile' ||
                  fileName.endsWith('.yml') ||
                  fileName.endsWith('.yaml') ||
                  fileName === '.env.example' ||
                  fileName === 'dockerfile' ||
                  fileName === 'docker-compose.yml' ||
                  filePath.includes('docs/') ||
                  filePath.includes('documentation/')) {
                results.push(filePath);
              }
            } else if (item.type === 'dir') {
              // Skip deep nested directories to avoid rate limits
              const depth = path.split('/').filter(p => p).length;
              if (depth < 3) {
                const subResults = await scanGitHubDirectory(item.path);
                results.push(...subResults);
              }
            }
          }));
        }
      } catch (error) {
        console.error(`Error scanning directory ${path}:`, error);
      }
      
      return results;
    }
    
    // Start scanning from root
    console.log(`Starting repository scan for ${repo}...`);
    scanResults.existingDocs = await scanGitHubDirectory();
    scanResults.fileCount = scanResults.existingDocs.length;
    console.log(`Found ${scanResults.fileCount} documentation files`);

    // Analyze package.json from GitHub
    try {
      const packageUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/package.json`;
      const packageResponse = await fetch(packageUrl, {
        headers: {
          ...headers,
          'Accept': 'application/vnd.github.v3.raw'
        }
      });
      
      if (packageResponse.ok) {
        const packageJson = JSON.parse(await packageResponse.text());
        
        scanResults.projectName = packageJson.name || repoName;
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
        if (deps.svelte) scanResults.detectedTechStack.push('Svelte');
        if (deps.angular) scanResults.detectedTechStack.push('Angular');
        if (deps.django) scanResults.detectedTechStack.push('Django');
        if (deps.flask) scanResults.detectedTechStack.push('Flask');
        if (deps.nestjs) scanResults.detectedTechStack.push('NestJS');
      }
    } catch (error) {
      console.error('Failed to fetch package.json:', error);
      
      // Try other tech stack indicators
      if (scanResults.existingDocs.some(f => f === 'requirements.txt' || f === 'setup.py')) {
        scanResults.detectedTechStack.push('Python');
      }
      if (scanResults.existingDocs.some(f => f === 'Cargo.toml')) {
        scanResults.detectedTechStack.push('Rust');
      }
      if (scanResults.existingDocs.some(f => f === 'go.mod')) {
        scanResults.detectedTechStack.push('Go');
      }
      if (scanResults.existingDocs.some(f => f === 'Gemfile')) {
        scanResults.detectedTechStack.push('Ruby');
      }
    }

    // Check for existing CLAUDE.md in GitHub
    try {
      const claudeUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/CLAUDE.md`;
      const claudeResponse = await fetch(claudeUrl, { headers });
      scanResults.hasExistingClaudeMd = claudeResponse.ok;
    } catch {
      scanResults.hasExistingClaudeMd = false;
    }

    // Analyze existing documentation
    for (const docFile of scanResults.existingDocs.slice(0, 10)) { // Limit to first 10
      try {
        const fileUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${docFile}`;
        const fileResponse = await fetch(fileUrl, {
          headers: {
            ...headers,
            'Accept': 'application/vnd.github.v3.raw'
          }
        });
        
        if (fileResponse.ok) {
          const content = await fileResponse.text();
          const firstLine = content.split('\n')[0];
          
          if (docFile.toLowerCase().includes('readme')) {
            scanResults.insights.readmeFirstLine = firstLine;
          }
          
          // Look for TODO, FIXME, etc.
          const todoMatches = content.match(/TODO|FIXME|HACK|XXX/gi);
          if (todoMatches) {
            scanResults.insights.todosFound = (scanResults.insights.todosFound || 0) + todoMatches.length;
          }
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

    // Check for cleanup files in the scanned docs
    for (const file of potentialCleanupFiles) {
      if (scanResults.existingDocs.includes(file)) {
        scanResults.cleanupSuggestions.push(file);
      }
    }
    
    // Check for backup/temp directories
    const cleanupDirs = ['backup', 'temp', 'old', '_backup', 'archive', 'deprecated'];
    for (const dir of cleanupDirs) {
      // Check if any file path starts with these directory names
      if (scanResults.existingDocs.some(doc => doc.startsWith(dir + '/'))) {
        scanResults.cleanupSuggestions.push(dir + '/');
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