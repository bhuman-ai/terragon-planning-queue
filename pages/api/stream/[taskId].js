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
  const { taskId, token } = req.query;
  const sessionToken = token || req.headers['x-session-token'];

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
          'next-action': '7f40cb55e87cce4b3543b51a374228296bc2436c6d',
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
      
      // Parse React Server Component response
      const messages = [];
      const lines = result.split('\n').filter(line => line.trim());
      
      let taskData = null;
      let streamContent = '';
      
      // Process each line
      for (const line of lines) {
        // Type 0: Initial metadata
        if (line.startsWith('0:')) {
          continue;
        }
        
        // Type 2: Streaming content chunks
        if (line.startsWith('2:')) {
          const content = line.substring(2);
          // Remove the prefix like "Tb52," or similar
          const cleanContent = content.replace(/^[A-Za-z0-9]+,/, '');
          streamContent += cleanContent;
        }
        
        // Type 1: Final JSON data
        if (line.startsWith('1:')) {
          try {
            const jsonStr = line.substring(2);
            taskData = JSON.parse(jsonStr);
          } catch (e) {
            console.error('Failed to parse task data:', e);
          }
        }
      }
      
      // Parse messages from task data if available
      if (taskData && taskData.messages && Array.isArray(taskData.messages)) {
        taskData.messages.forEach(msg => {
          if (msg.type === 'user' && msg.parts && msg.parts[0]) {
            // User message
            let text = '';
            if (msg.parts[0].nodes && msg.parts[0].nodes[0]) {
              text = msg.parts[0].nodes[0].text;
            } else if (typeof msg.parts[0] === 'string') {
              text = msg.parts[0];
            }
            
            if (text) {
              messages.push({
                type: 'user',
                content: text,
                timestamp: msg.timestamp
              });
            }
          } else if (msg.type === 'agent' && msg.parts && msg.parts[0]) {
            // Agent message
            let text = '';
            if (msg.parts[0].text) {
              text = msg.parts[0].text;
            } else if (typeof msg.parts[0] === 'string') {
              text = msg.parts[0];
            }
            
            if (text && text !== '$2') { // Skip placeholder
              messages.push({
                type: 'assistant',
                content: text,
                timestamp: msg.timestamp || new Date().toISOString()
              });
            }
          } else if (msg.type === 'meta' && msg.result) {
            // Meta result message (final assistant response)
            messages.push({
              type: 'assistant',
              content: msg.result,
              timestamp: new Date().toISOString()
            });
          }
        });
      }
      
      // If we have streaming content but no messages parsed, add it as assistant message
      if (messages.length === 0 && streamContent.trim()) {
        messages.push({
          type: 'assistant',
          content: streamContent.trim(),
          timestamp: new Date().toISOString()
        });
      }
      
      // Include task status if available
      let taskStatus = null;
      if (taskData) {
        taskStatus = {
          id: taskData.id,
          status: taskData.status,
          createdAt: taskData.createdAt,
          updatedAt: taskData.updatedAt
        };
      }

      // Send update if we have new messages
      if (messages.length > lastMessageCount) {
        res.write(`data: ${JSON.stringify({ 
          type: 'messages',
          taskId: taskId,
          messages: messages,
          newMessages: messages.slice(lastMessageCount),
          totalMessages: messages.length,
          pollCount: pollCount,
          taskStatus: taskStatus
        })}\n\n`);
        lastMessageCount = messages.length;
      } else {
        // Send heartbeat
        res.write(`data: ${JSON.stringify({ 
          type: 'heartbeat',
          taskId: taskId,
          pollCount: pollCount,
          status: 'waiting',
          taskStatus: taskStatus
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