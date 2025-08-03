// Test the scan functionality directly without HTTP
require('dotenv').config({ path: '.env.local' });

async function testScanDirect() {
  console.log('Testing scan functionality directly...\n');
  console.log('Environment check:');
  console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? 'Set' : 'Not set');
  console.log('Token value:', process.env.GITHUB_TOKEN?.substring(0, 10) + '...' || 'None');
  
  // Import the handler
  const handler = require('./pages/api/calibration/scan').default;
  
  // Mock request and response
  const mockReq = {
    method: 'POST',
    body: {
      repo: 'bhuman-ai/gesture_generator'
    }
  };
  
  const mockRes = {
    status: null,
    json: null,
    statusCode: 200,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      console.log('\nResponse:', JSON.stringify(data, null, 2));
      return this;
    }
  };
  
  try {
    await handler(mockReq, mockRes);
  } catch (error) {
    console.error('Error:', error);
  }
}

testScanDirect();