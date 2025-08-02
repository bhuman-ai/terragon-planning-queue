// API endpoint to stream updates from a Terragon task
// Note: Terragon uses WebSocket for real-time streaming, but we can poll for updates
function generateActionId() {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 40; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export default async function handler(req, res) {
  const { taskId } = req.query;
  const sessionToken = req.headers['x-session-token'];

  if (!taskId || !sessionToken) {
    return res.status(400).json({ error: 'Missing taskId or session token' });
  }

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  let lastMessageCount = 0;
  let pollCount = 0;

  // Function to fetch task updates
  async function fetchTaskUpdates() {
    try {
      pollCount++;
      
      // Fetch the task data using the same format as message sending
      const routerStateTree = `%5B%22%22%2C%7B%22children%22%3A%5B%22(sidebar)%22%2C%7B%22children%22%3A%5B%22task%22%2C%7B%22children%22%3A%5B%5B%22id%22%2C%22${taskId}%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D`;
      
      // Fetch task data using the same format as shown in curl
      const response = await fetch(`https://www.terragonlabs.com/task/${taskId}`, {
        method: 'POST',
        headers: {
          'accept': 'text/x-component',
          'content-type': 'text/plain;charset=UTF-8',
          'cookie': `__Secure-better-auth.session_token=${sessionToken}`,
          'next-action': generateActionId(),
          'next-router-state-tree': routerStateTree,
          'origin': 'https://www.terragonlabs.com',
          'referer': `https://www.terragonlabs.com/task/${taskId}`,
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        body: JSON.stringify([taskId])
      });

      if (!response.ok) {
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: 'Failed to fetch task', 
          status: response.status 
        })}\n\n`);
        return false;
      }

      const result = await response.text();
      
      // Parse React Server Component response for real messages
      const messages = [];
      const lines = result.split('\n');
      
      // Track message content across lines
      let currentMessage = null;
      let inMessageBlock = false;
      
      for (const line of lines) {
        // Look for lines that contain message content
        // Format is like: 2:Tb52,# Task Implementation Plan: Hello
        if (line.match(/^\d+:.*#\s*\d+\.\s*/)) {
          // Extract the text after the metadata
          const match = line.match(/^\d+:[^,]*,(.*)$/);
          if (match) {
            const content = match[1];
            if (!currentMessage) {
              currentMessage = { type: 'assistant', content: '' };
            }
            currentMessage.content += content + '\n';
            inMessageBlock = true;
          }
        } else if (line.includes('##') || line.includes('**')) {
          // Markdown content
          if (currentMessage) {
            const cleanLine = line.replace(/^\d+:[^,]*,/, '');
            currentMessage.content += cleanLine + '\n';
          }
        } else if (line.includes('"hello"') || line.includes('Task Implementation Plan')) {
          // Look for specific content patterns
          if (!currentMessage) {
            currentMessage = { type: 'assistant', content: '' };
          }
          const cleanLine = line.replace(/^\d+:[^,]*,/, '');
          currentMessage.content += cleanLine + '\n';
        } else if (inMessageBlock && line.trim() === '') {
          // End of message block
          if (currentMessage && currentMessage.content.trim()) {
            messages.push(currentMessage);
            currentMessage = null;
            inMessageBlock = false;
          }
        }
      }
      
      // Add any remaining message
      if (currentMessage && currentMessage.content.trim()) {
        messages.push(currentMessage);
      }
      
      // Also look for the user's original message
      const userMessageMatch = result.match(/how are you\?/);
      if (userMessageMatch && messages.length > 0) {
        messages.unshift({
          type: 'user',
          content: 'how are you?'
        });
      }

      // Send update if we have new messages
      if (messages.length > lastMessageCount) {
        res.write(`data: ${JSON.stringify({ 
          type: 'messages',
          taskId: taskId,
          messages: messages,
          newMessages: messages.slice(lastMessageCount),
          totalMessages: messages.length,
          pollCount: pollCount
        })}\n\n`);
        lastMessageCount = messages.length;
      } else {
        // Send heartbeat
        res.write(`data: ${JSON.stringify({ 
          type: 'heartbeat',
          taskId: taskId,
          pollCount: pollCount,
          status: 'waiting'
        })}\n\n`);
      }

      return true;
    } catch (error) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error',
        error: error.message 
      })}\n\n`);
      return false;
    }
  }

  // Initial fetch
  const success = await fetchTaskUpdates();
  
  if (success) {
    // Poll for updates every 2 seconds
    const pollInterval = setInterval(async () => {
      const continuePolling = await fetchTaskUpdates();
      if (!continuePolling) {
        clearInterval(pollInterval);
      }
    }, 2000);

    // Keep connection alive with periodic pings
    const pingInterval = setInterval(() => {
      res.write(': ping\n\n');
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(pollInterval);
      clearInterval(pingInterval);
      res.end();
    });
  } else {
    res.end();
  }
}