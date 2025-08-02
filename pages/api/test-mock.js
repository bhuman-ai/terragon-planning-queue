// Mock endpoint to test the full flow without a real session token
export default async function handler(req, res) {
  const { action } = req.query;
  
  // Simulate different parts of the flow
  switch (action) {
    case 'create':
      // Simulate task creation
      res.status(200).json({
        success: true,
        status: 200,
        taskId: 'mock-task-' + Date.now(),
        terragonUrl: 'https://www.terragonlabs.com/task/mock-task',
        responseFormat: 'streaming',
        linesCount: 3
      });
      break;
      
    case 'stream':
      // Simulate SSE streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Send mock messages
      const messages = [
        {
          type: 'user',
          content: 'Create a simple hello world function in JavaScript',
          timestamp: new Date().toISOString()
        },
        {
          type: 'assistant',
          content: `Here's a simple hello world function in JavaScript:

\`\`\`javascript
function helloWorld() {
  console.log("Hello, World!");
}

// Call the function
helloWorld();
\`\`\`

This function simply prints "Hello, World!" to the console when called.`,
          timestamp: new Date().toISOString()
        }
      ];
      
      res.write(`data: ${JSON.stringify({
        type: 'messages',
        taskId: req.query.taskId,
        messages: messages,
        totalMessages: messages.length
      })}\n\n`);
      
      // Keep connection alive
      const interval = setInterval(() => {
        res.write(': ping\n\n');
      }, 30000);
      
      req.on('close', () => {
        clearInterval(interval);
        res.end();
      });
      break;
      
    case 'message':
      // Simulate sending a message
      res.status(200).json({
        success: true,
        status: 200,
        taskId: req.query.taskId,
        message: 'Message sent successfully'
      });
      break;
      
    default:
      res.status(400).json({ error: 'Invalid action' });
  }
}