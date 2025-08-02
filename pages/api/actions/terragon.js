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
    if (req.body.enrichContext !== false && githubRepoFullName) {
      // SACRED: Always include CLAUDE.md content from the selected project repository
      try {
        // Extract owner and repo from githubRepoFullName (format: "owner/repo")
        const [owner, repo] = githubRepoFullName.split('/');
        const branch = repoBaseBranchName || 'main';
        
        // Fetch CLAUDE.md from the GitHub repository
        const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/CLAUDE.md?ref=${branch}`;
        console.log(`Fetching CLAUDE.md from: ${githubUrl}`);
        
        const headers = {
          'Accept': 'application/vnd.github.v3.raw',
          'User-Agent': 'Terragon-Planning-Queue'
        };
        
        // Add GitHub token if available for private repos
        if (process.env.GITHUB_TOKEN) {
          headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
        }
        
        const response = await fetch(githubUrl, { headers });
        
        if (response.ok) {
          const claudeMdContent = await response.text();
          
          // Prepend CLAUDE.md content to the message
          processedMessage = `# SACRED PROJECT CONTEXT (CLAUDE.md from ${githubRepoFullName})\n\n${claudeMdContent}\n\n---\n\n# USER REQUEST\n\n${message}`;
          
          console.log(`Enriched message with CLAUDE.md content from ${githubRepoFullName}`);
        } else {
          console.log(`CLAUDE.md not found in ${githubRepoFullName}, proceeding without sacred context`);
        }
      } catch (error) {
        console.log(`Error fetching CLAUDE.md from ${githubRepoFullName}:`, error.message);
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