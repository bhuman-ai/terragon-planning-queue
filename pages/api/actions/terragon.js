// Alternative endpoint for Next.js server actions
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionToken, payload, actionId } = req.body;
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Session token required' });
    }

    console.log('Server action request:', { hasPayload: !!payload, actionId });

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
        'Next-Action': actionId || generateActionId()
      },
      body: JSON.stringify(payload)
    });

    const result = await response.text();
    
    // Parse any task IDs from the response
    const taskIdMatch = result.match(/"id":"([a-f0-9-]+)"/);
    
    res.status(200).json({
      success: response.ok,
      status: response.status,
      data: result,
      taskId: taskIdMatch ? taskIdMatch[1] : null
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