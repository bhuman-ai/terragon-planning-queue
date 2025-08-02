import fs from 'fs/promises';
import path from 'path';

// Alternative endpoint for Next.js server actions
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionToken, message, githubRepoFullName, repoBaseBranchName } = req.body;
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Session token required' });
    }

    console.log('Server action request:', { 
      hasMessage: !!message, 
      repo: githubRepoFullName 
    });

    // Enrich message with context if enrichContext is enabled
    let processedMessage = message;
    if (req.body.enrichContext !== false) {
      let contextParts = [];
      
      // 1. Always include dev.md (static development principles)
      try {
        const devMdPath = path.join(process.cwd(), 'public', 'dev.md');
        const devMdContent = await fs.readFile(devMdPath, 'utf-8');
        contextParts.push(`# UNIVERSAL DEVELOPMENT PRINCIPLES (dev.md)\n\n${devMdContent}`);
        console.log('Included universal dev.md principles');
      } catch (error) {
        console.log('Error reading dev.md:', error.message);
      }
      
      // 2. Include project-specific CLAUDE.md if repository is specified
      if (githubRepoFullName) {
        try {
          // Extract owner and repo from githubRepoFullName (format: "owner/repo")
          const [owner, repo] = githubRepoFullName.split('/');
          const branch = repoBaseBranchName || 'main';
          
          const headers = {
            'Accept': 'application/vnd.github.v3.raw',
            'User-Agent': 'Terragon-Planning-Queue'
          };
          
          // Add GitHub token if available for private repos
          if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
          }
          
          // Fetch CLAUDE.md
          const claudeUrl = `https://api.github.com/repos/${owner}/${repo}/contents/CLAUDE.md?ref=${branch}`;
          console.log(`Fetching CLAUDE.md from: ${claudeUrl}`);
          
          const claudeResponse = await fetch(claudeUrl, { headers });
          
          if (claudeResponse.ok) {
            const claudeMdContent = await claudeResponse.text();
            contextParts.push(`# PROJECT-SPECIFIC CONTEXT (CLAUDE.md from ${githubRepoFullName})\n\n${claudeMdContent}`);
            console.log(`Included CLAUDE.md from ${githubRepoFullName}`);
          } else {
            console.log(`CLAUDE.md not found in ${githubRepoFullName}`);
          }
          
          // 3. Try to fetch task.md if it exists
          const taskUrl = `https://api.github.com/repos/${owner}/${repo}/contents/task.md?ref=${branch}`;
          console.log(`Checking for task.md from: ${taskUrl}`);
          
          const taskResponse = await fetch(taskUrl, { headers });
          
          if (taskResponse.ok) {
            const taskMdContent = await taskResponse.text();
            contextParts.push(`# CURRENT TASK CONTEXT (task.md from ${githubRepoFullName})\n\n${taskMdContent}`);
            console.log(`Included task.md from ${githubRepoFullName}`);
          } else {
            console.log(`task.md not found in ${githubRepoFullName}`);
          }
        } catch (error) {
          console.log(`Error fetching project documents from ${githubRepoFullName}:`, error.message);
        }
      }
      
      // Combine all context parts with the user message
      if (contextParts.length > 0) {
        processedMessage = contextParts.join('\n\n---\n\n') + '\n\n---\n\n# USER REQUEST\n\n' + message;
        console.log(`Enriched message with ${contextParts.length} context documents`);
      }
    }

    // Build the payload in Terragon's expected format
    const terragonPayload = [{
      message: {
        type: "user",
        model: "sonnet",
        parts: [{
          type: "rich-text",
          nodes: [{
            type: "text",
            text: processedMessage
          }]
        }],
        timestamp: new Date().toISOString()
      },
      githubRepoFullName: githubRepoFullName || "bhuman-ai/gesture_generator",
      repoBaseBranchName: repoBaseBranchName || "main",
      saveAsDraft: false
    }];

    // Forward to Terragon with proper headers
    // CRITICAL: next-router-state-tree header is REQUIRED or we get 404
    const response = await fetch('https://www.terragonlabs.com/dashboard', {
      method: 'POST',
      headers: {
        'accept': 'text/x-component',
        'content-type': 'text/plain;charset=UTF-8',
        'cookie': `__Secure-better-auth.session_token=${sessionToken}`,
        'next-action': '7f7cba8a674421dfd9e9da7470ee4d79875a158bc9',
        'next-router-state-tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22(sidebar)%22%2C%7B%22children%22%3A%5B%22(site-header)%22%2C%7B%22children%22%3A%5B%22dashboard%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D',
        'origin': 'https://www.terragonlabs.com',
        'referer': 'https://www.terragonlabs.com/dashboard',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      body: JSON.stringify(terragonPayload)
    });

    const result = await response.text();
    console.log('Terragon response status:', response.status);
    console.log('Raw response:', result);
    
    // Parse the streaming response format
    // Terragon returns lines like:
    // 0:{"a":"$@1","f":"","b":"N2-pmBwjnwTcDILjBgwJq"}
    // 1:{"id":"23c0422e-65f6-41fa-99a2-fe64fdfcfc87"}
    
    let taskId = null;
    const lines = result.split('\n');
    
    for (const line of lines) {
      if (line.includes('"id":')) {
        try {
          // Extract JSON from line (format is "number:{json}")
          const jsonPart = line.substring(line.indexOf('{'));
          const parsed = JSON.parse(jsonPart);
          if (parsed.id) {
            taskId = parsed.id;
            break;
          }
        } catch (e) {
          // Try regex as fallback
          const match = line.match(/"id":"([a-f0-9-]+)"/);
          if (match) {
            taskId = match[1];
            break;
          }
        }
      }
    }
    
    res.status(200).json({
      success: response.ok,
      status: response.status,
      taskId: taskId,
      terragonUrl: taskId ? `https://www.terragonlabs.com/task/${taskId}` : null,
      responseFormat: 'streaming',
      linesCount: lines.length
    });
  } catch (error) {
    console.error('Server action error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process action', 
      details: error.message 
    });
  }
}

function generateActionId() {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 40; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}