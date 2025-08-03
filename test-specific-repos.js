// Test specific repositories that are returning 0 files
require('dotenv').config({ path: '.env.local' });

async function testSpecificRepos() {
  console.log('Testing specific repositories...\n');
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Terragon-Planning-Queue'
  };
  
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== 'YOUR_GITHUB_TOKEN_HERE') {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    console.log('Using GitHub token for authentication\n');
  }
  
  // Test gesture_generator first
  console.log('1. Testing bhuman-ai/gesture_generator:');
  try {
    const response = await fetch('https://api.github.com/repos/bhuman-ai/gesture_generator/contents/', { headers });
    console.log(`   Status: ${response.status}`);
    
    if (response.ok) {
      const items = await response.json();
      console.log(`   Items found: ${items.length}`);
      console.log(`   First 5 items:`, items.slice(0, 5).map(i => ({ name: i.name, type: i.type })));
    } else {
      const error = await response.text();
      console.log(`   Error: ${error}`);
    }
  } catch (error) {
    console.log(`   Network error: ${error.message}`);
  }
  
  // Test vercel/next.js
  console.log('\n2. Testing vercel/next.js:');
  try {
    const response = await fetch('https://api.github.com/repos/vercel/next.js/contents/', { headers });
    console.log(`   Status: ${response.status}`);
    
    if (response.ok) {
      const items = await response.json();
      console.log(`   Items found: ${items.length}`);
      console.log(`   Contains docs folder:`, items.some(i => i.name === 'docs'));
      console.log(`   Contains README:`, items.some(i => i.name.toLowerCase().includes('readme')));
    } else {
      const error = await response.text();
      console.log(`   Error: ${error}`);
    }
  } catch (error) {
    console.log(`   Network error: ${error.message}`);
  }
  
  // Test anthropics/anthropic-sdk-typescript
  console.log('\n3. Testing anthropics/anthropic-sdk-typescript:');
  try {
    const response = await fetch('https://api.github.com/repos/anthropics/anthropic-sdk-typescript/contents/', { headers });
    console.log(`   Status: ${response.status}`);
    
    if (response.ok) {
      const items = await response.json();
      console.log(`   Items found: ${items.length}`);
      console.log(`   First 5 items:`, items.slice(0, 5).map(i => ({ name: i.name, type: i.type })));
    } else {
      const error = await response.text();
      console.log(`   Error: ${error}`);
    }
  } catch (error) {
    console.log(`   Network error: ${error.message}`);
  }
}

testSpecificRepos();