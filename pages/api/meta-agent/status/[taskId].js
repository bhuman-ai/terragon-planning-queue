export default async function handler(req, res) {
  const { taskId } = req.query;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial connection
  res.write(`data: ${JSON.stringify({ 
    type: 'connected', 
    taskId,
    message: 'Connected to task status stream' 
  })}\n\n`);

  // Simulate task progress updates
  const steps = [
    { type: 'progress', step: 'requirements', message: 'Analyzing requirements...', progress: 10 },
    { type: 'progress', step: 'research', message: 'Researching best practices...', progress: 25 },
    { type: 'progress', step: 'decomposition', message: 'Breaking down into micro-tasks...', progress: 40 },
    { type: 'progress', step: 'structure', message: 'Creating task folder structure...', progress: 60 },
    { type: 'progress', step: 'documentation', message: 'Generating task documentation...', progress: 80 },
    { type: 'progress', step: 'terragon', message: 'Sending to Terragon for review...', progress: 90 },
    { type: 'complete', message: 'Task creation complete!', progress: 100 }
  ];

  let currentStep = 0;
  
  const interval = setInterval(() => {
    if (currentStep < steps.length) {
      res.write(`data: ${JSON.stringify({
        ...steps[currentStep],
        taskId,
        timestamp: new Date().toISOString()
      })}\n\n`);
      
      currentStep++;
    } else {
      clearInterval(interval);
      res.write(`data: ${JSON.stringify({ 
        type: 'done', 
        taskId,
        message: 'Stream complete' 
      })}\n\n`);
      res.end();
    }
  }, 1500);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
}