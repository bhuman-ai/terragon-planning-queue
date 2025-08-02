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
      
      // Parse React Server Component response for real messages
      const messages = [];
      
      // Look for the JSON data at the end which contains all messages
      const jsonMatch = result.match(/1:\{"id":"[^"]+","userId"[^}]+,"messages":\[(.*?)\],"queuedMessages"/s);
      
      if (jsonMatch) {
        try {
          // Extract and parse the messages array
          const messagesJson = '[' + jsonMatch[1] + ']';
          const parsedMessages = JSON.parse(messagesJson);
          
          parsedMessages.forEach(msg => {
            if (msg.type === 'user' && msg.parts && msg.parts[0] && msg.parts[0].nodes) {
              // User message
              const text = msg.parts[0].nodes[0].text;
              if (text) {
                messages.push({
                  type: 'user',
                  content: text,
                  timestamp: msg.timestamp
                });
              }
            } else if (msg.type === 'agent' && msg.parts && msg.parts[0]) {
              // Assistant message
              const text = msg.parts[0].text;
              if (text && text !== '$2') { // Skip placeholder text
                messages.push({
                  type: 'assistant', 
                  content: text,
                  timestamp: msg.timestamp
                });
              }
            }
          });
        } catch (e) {
          console.error('Failed to parse messages JSON:', e);
        }
      }
      
      // If JSON parsing fails, try to extract the formatted response
      if (messages.length === 0) {
        // Extract the markdown content between line 2 and line 90
        const lines = result.split('\n');
        let markdownContent = '';
        let inContent = false;
        
        for (const line of lines) {
          if (line.startsWith('2:') && line.includes('Task Implementation Plan')) {
            inContent = true;
            markdownContent += line.replace(/^\d+:[^,]*,/, '') + '\n';
          } else if (inContent && line.match(/^\d+:/)) {
            const cleanLine = line.replace(/^\d+:[^,]*,/, '');
            markdownContent += cleanLine + '\n';
            
            // Stop at the end of markdown
            if (line.includes('```1:')) {
              break;
            }
          }
        }
        
        if (markdownContent.trim()) {
          messages.push({
            type: 'assistant',
            content: markdownContent.trim()
          });
        }
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