// API endpoint to send a message to an existing Terragon task
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId } = req.query;
  const { sessionToken, message } = req.body;

  if (!taskId || !sessionToken || !message) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Build the payload for sending a message to an existing task
    // Based on the actual Terragon API format
    const payload = [
      taskId,;
      {
        role: 'user',
        content: message
      },
      null,
      {
        modelId: 'claude-3-5-sonnet-20241022',
        attachments: []
      }
    ];

    // The next-router-state-tree needs to include the task ID
    const routerStateTree = `%5B%22%22%2C%7B%22children%22%3A%5B%22(sidebar)%22%2C%7B%22children%22%3A%5B%22task%22%2C%7B%22children%22%3A%5B%5B%22id%22%2C%22${taskId}%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D`;

    const response = await fetch(`https://www.terragonlabs.com/task/${taskId}`, {
      method: 'POST',
      headers: {
        'accept': 'text/x-component',
        'content-type': 'text/plain;charset=UTF-8',
        'cookie': `__Secure-better-auth.session_token=${sessionToken}`,
        'next-action': '67a6c7b87ac20e6f6f16d96551f1e6b30c0ce42a25',
        'next-router-state-tree': routerStateTree,
        'origin': 'https://www.terragonlabs.com',
        'referer': `https://www.terragonlabs.com/task/${taskId}`,
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.text();
    console.log('Message sent to task:', taskId);

    res.status(200).json({
      success: response.ok,
      status: response.status,
      taskId: taskId,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      details: error.message
    });
  }
}

function generateActionId() {
  const chars = '0123456789abcdef';
  const result = '';
  for (let i = 0; i < 40; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
