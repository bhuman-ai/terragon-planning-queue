const fetch = require('node-fetch');

async function testScan() {
  console.log('Testing calibration scan endpoint...\n');
  
  const testRepos = [
    'facebook/react',
    'vercel/next.js',
    'anthropics/anthropic-sdk-typescript',
    'bhuman-ai/gesture_generator'
  ];

  for (const repo of testRepos) {
    console.log(`\nScanning ${repo}...`);
    
    try {
      const response = await fetch('http://localhost:3001/api/calibration/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ repo })
      });

      const data = await response.json();
      
      console.log(`Status: ${response.status}`);
      console.log(`Files found: ${data.fileCount || 0}`);
      console.log(`Tech stack: ${data.detectedTechStack?.join(', ') || 'none'}`);
      
      if (data.error) {
        console.log(`Error: ${data.error}`);
      }
      
      if (data.existingDocs && data.existingDocs.length > 0) {
        console.log(`Sample docs: ${data.existingDocs.slice(0, 3).join(', ')}...`);
      }
    } catch (error) {
      console.error(`Failed to scan ${repo}:`, error.message);
    }
  }
}

testScan();