export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Session-Token, X-Next-Action'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionToken = req.headers['x-session-token'];
    if (!sessionToken) {
      return res.status(401).json({ error: 'Session token required' });
    }

    console.log('Proxying request to Terragon...');

    // Forward request to Terragon
    const response = await fetch('https://www.terragonlabs.com/dashboard', {
      method: 'POST',
      headers: {
        'Accept': 'text/x-component',
        'Content-Type': 'text/plain;charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Cookie': `__Secure-better-auth.session_token=${sessionToken}`,
        'Origin': 'https://www.terragonlabs.com',
        'Referer': 'https://www.terragonlabs.com/dashboard',
        'Next-Action': req.headers['x-next-action'] || generateActionId()
      },
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    });

    let result = await response.text();
    console.log('Terragon response status:', response.status);

    // Set proper content type for the response
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain');
    res.status(response.status).send(result);
  } catch (error) {
    console.error('Terragon proxy error:', error);
    res.status(500).json({ error: 'Failed to connect to Terragon', details: error.message });
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
