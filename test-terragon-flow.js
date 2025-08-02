const fetch = require('node-fetch');

// Replace with your actual session token
const SESSION_TOKEN = 'YOUR_SESSION_TOKEN_HERE';
const BASE_URL = 'http://localhost:3000';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFullFlow() {
  console.log('🚀 Testing Terragon Full Flow...\n');

  try {
    // Step 1: Create a new task
    console.log('1️⃣ Creating a new task...');
    const createResponse = await fetch(`${BASE_URL}/api/actions/terragon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionToken: SESSION_TOKEN,
        message: 'Create a simple hello world function in JavaScript',
        githubRepoFullName: 'bhuman-ai/gesture_generator',
        repoBaseBranchName: 'main'
      })
    });

    const createResult = await createResponse.json();
    console.log('Task created:', createResult);

    if (!createResult.taskId) {
      throw new Error('Failed to get task ID');
    }

    const taskId = createResult.taskId;
    console.log(`✅ Task ID: ${taskId}`);
    console.log(`📎 Terragon URL: ${createResult.terragonUrl}\n`);

    // Step 2: Wait a bit for processing
    console.log('2️⃣ Waiting for initial response...');
    await delay(5000);

    // Step 3: Get task messages via streaming endpoint
    console.log('3️⃣ Fetching task messages...');
    const streamResponse = await fetch(`${BASE_URL}/api/stream/${taskId}?token=${encodeURIComponent(SESSION_TOKEN)}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream'
      }
    });

    // Read first few chunks
    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    let messageCount = 0;

    while (messageCount < 5) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.type === 'messages' && data.messages) {
              console.log(`📩 Received ${data.messages.length} messages`);
              data.messages.forEach((msg, idx) => {
                console.log(`   ${idx + 1}. ${msg.type}: ${msg.content.substring(0, 100)}...`);
              });
              messageCount++;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    reader.cancel();

    // Step 4: Send a follow-up message
    console.log('\n4️⃣ Sending follow-up message...');
    const messageResponse = await fetch(`${BASE_URL}/api/task/${taskId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionToken: SESSION_TOKEN,
        message: 'Can you make it print the current date as well?'
      })
    });

    const messageResult = await messageResponse.json();
    console.log('Message sent:', messageResult);

    // Step 5: Wait and check for response
    console.log('\n5️⃣ Waiting for response to follow-up...');
    await delay(5000);

    // Fetch messages again
    const finalStreamResponse = await fetch(`${BASE_URL}/api/stream/${taskId}?token=${encodeURIComponent(SESSION_TOKEN)}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream'
      }
    });

    const finalReader = finalStreamResponse.body.getReader();
    const finalDecoder = new TextDecoder();
    let finalMessageCount = 0;

    while (finalMessageCount < 3) {
      const { done, value } = await finalReader.read();
      if (done) break;

      const chunk = finalDecoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.type === 'messages' && data.messages) {
              console.log(`📩 Total messages: ${data.messages.length}`);
              if (data.newMessages && data.newMessages.length > 0) {
                console.log('🆕 New messages:');
                data.newMessages.forEach((msg) => {
                  console.log(`   ${msg.type}: ${msg.content.substring(0, 100)}...`);
                });
              }
              finalMessageCount++;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    finalReader.cancel();

    console.log('\n✅ Full flow test completed successfully!');
    console.log(`🔗 View task at: ${BASE_URL}/task/${taskId}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run the test
if (SESSION_TOKEN === 'YOUR_SESSION_TOKEN_HERE') {
  console.error('⚠️  Please update SESSION_TOKEN with your actual token first!');
  console.log('\nTo get your session token:');
  console.log('1. Log in to https://www.terragonlabs.com');
  console.log('2. Open DevTools (F12)');
  console.log('3. Go to Application → Cookies');
  console.log('4. Find "__Secure-better-auth.session_token"');
  console.log('5. Copy the value and update this script');
} else {
  testFullFlow();
}