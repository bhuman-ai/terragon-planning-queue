export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { session_token } = req.body;
    if (!session_token) {
      return res.status(400).json({ error: 'Session token required' });
    }

    // Test session validity
    const response = await fetch('https://www.terragonlabs.com/dashboard', {
      method: 'GET',
      headers: {
        'Cookie': `__Secure-better-auth.session_token=${session_token}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      redirect: 'manual'
    });

    // Check if redirected to auth
    if (response.status === 302 || response.status === 307) {
      const location = response.headers.get('location');
      if (location && location.includes('/auth')) {
        return res.json({ valid: false, message: 'Session expired or invalid' });
      }
    }

    if (response.status === 200) {
      return res.json({ valid: true, message: 'Session is valid' });
    }

    return res.json({
      valid: false,
      message: `Unexpected status: ${response.status}`
    });
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      valid: false,
      message: 'Error validating session'
    });
  }
}
