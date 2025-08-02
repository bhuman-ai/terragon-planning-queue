// API endpoint to stream updates from a Terragon task
// Note: Terragon uses WebSocket for real-time streaming, but we can poll for updates
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
      
      // For now, we'll use a simplified approach
      // In production, you'd want to connect to Terragon's WebSocket
      const response = await fetch(`https://www.terragonlabs.com/task/${taskId}`, {
        method: 'GET',
        headers: {
          'accept': 'text/html,application/xhtml+xml',
          'cookie': `__Secure-better-auth.session_token=${sessionToken}`,
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
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
      
      // For demo purposes, simulate messages based on poll count
      // In production, you'd parse the actual Terragon response or use WebSocket
      const messages = [];
      
      // Initial user message
      messages.push({
        type: 'user',
        content: 'Task created and processing...',
        timestamp: new Date().toISOString()
      });
      
      // Simulate AI responses based on poll count
      if (pollCount > 2) {
        messages.push({
          type: 'assistant',
          content: 'I\'m analyzing your request and preparing a detailed plan...',
          timestamp: new Date().toISOString()
        });
      }
      
      if (pollCount > 5) {
        messages.push({
          type: 'assistant',
          content: 'Here\'s what I\'m working on:\n1. Understanding the requirements\n2. Breaking down the task\n3. Creating implementation steps',
          timestamp: new Date().toISOString()
        });
      }
      
      // Note: In a real implementation, you would:
      // 1. Connect to Terragon's WebSocket endpoint
      // 2. Parse their streaming protocol
      // 3. Extract actual messages from the conversation

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