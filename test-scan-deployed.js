const fetch = require('node-fetch');

async function testDeployedScan() {
  console.log('Testing calibration scan on deployed version...\n');
  
  const baseUrl = 'https://terragon-vercel-six.vercel.app';
  
  const testRepos = [
    'bhuman-ai/gesture_generator',
    'facebook/react',
    'vercel/next.js',
    'anthropics/anthropic-sdk-typescript'
  ];

  for (const repo of testRepos) {
    console.log(`\n📦 Scanning ${repo}...`);
    
    try {
      const response = await fetch(`${baseUrl}/api/calibration/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ repo })
      });

      const data = await response.json();
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`📁 Files found: ${data.fileCount || 0}`);
      console.log(`🔧 Tech stack: ${data.detectedTechStack?.join(', ') || 'none'}`);
      
      if (data.error) {
        console.log(`❌ Error: ${data.error}`);
      }
      
      if (data.existingDocs && data.existingDocs.length > 0) {
        console.log(`📄 Sample docs: ${data.existingDocs.slice(0, 5).join(', ')}${data.existingDocs.length > 5 ? '...' : ''}`);
      }
      
      if (data.packageInfo && data.packageInfo.version) {
        console.log(`📦 Package version: ${data.packageInfo.version}`);
      }
      
      if (data.insights && Object.keys(data.insights).length > 0) {
        console.log(`💡 Insights:`, data.insights);
      }
      
    } catch (error) {
      console.error(`❌ Failed to scan ${repo}:`, error.message);
    }
  }
  
  console.log('\n✅ Scan test completed!');
}

testDeployedScan();