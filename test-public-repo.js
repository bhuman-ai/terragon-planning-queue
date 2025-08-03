// Test scanning a public repository without authentication
require('dotenv').config({ path: '.env.local' });

// Temporarily remove the token to test public repo access
const originalToken = process.env.GITHUB_TOKEN;
delete process.env.GITHUB_TOKEN;

async function testPublicRepo() {
  console.log('Testing public repository scan without authentication...\n');
  
  const handler = require('./pages/api/calibration/scan').default;
  
  // Test with a small public repo
  const mockReq = {
    method: 'POST',
    body: {
      repo: 'octocat/Hello-World'  // GitHub's official example repo
    }
  };
  
  const mockRes = {
    statusCode: 200,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      console.log('\nResponse:', JSON.stringify(data, null, 2));
      
      // Restore token
      if (originalToken) {
        process.env.GITHUB_TOKEN = originalToken;
      }
      
      return this;
    }
  };
  
  try {
    await handler(mockReq, mockRes);
  } catch (error) {
    console.error('Error:', error);
    // Restore token
    if (originalToken) {
      process.env.GITHUB_TOKEN = originalToken;
    }
  }
}

testPublicRepo();