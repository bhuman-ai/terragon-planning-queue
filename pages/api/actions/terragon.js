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

    // Build the payload in Terragon's expected format
    const terragonPayload = [{
      message: {
        type: "user",
        model: "sonnet",
        parts: [{
          type: "rich-text",
          nodes: [{
            type: "text",
            text: message
          }]
        }],
        timestamp: new Date().toISOString()
      },
      githubRepoFullName: githubRepoFullName || "bhuman-ai/gesture_generator",
      repoBaseBranchName: repoBaseBranchName || "main",
      saveAsDraft: false
    }];

    // Forward to Terragon with proper headers
    const response = await fetch('https://www.terragonlabs.com/dashboard', {
      method: 'POST',
      headers: {
        'Accept': 'text/x-component',
        'Content-Type': 'text/plain;charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': `__Secure-better-auth.session_token=${sessionToken}`,
        'Origin': 'https://www.terragonlabs.com',
        'Referer': 'https://www.terragonlabs.com/dashboard',
        'Next-Action': generateActionId(),
        'Next-Router-State-Tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22(sidebar)%22%2C%7B%22children%22%3A%5B%22(site-header)%22%2C%7B%22children%22%3A%5B%22dashboard%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D'
      },
      body: JSON.stringify(terragonPayload)
    });

    const result = await response.text();
    console.log('Terragon response status:', response.status);
    
    // Try to extract task/thread ID from response
    let taskId = null;
    const idPatterns = [
      /"id":"([a-f0-9-]+)"/,
      /"threadId":"([a-f0-9-]+)"/,
      /task\/([a-f0-9-]+)/
    ];
    
    for (const pattern of idPatterns) {
      const match = result.match(pattern);
      if (match) {
        taskId = match[1];
        break;
      }
    }
    
    res.status(200).json({
      success: response.ok,
      status: response.status,
      data: result.substring(0, 500), // Limit response size for debugging
      taskId: taskId,
      fullResponse: result.length > 500 ? 'truncated' : 'complete'
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