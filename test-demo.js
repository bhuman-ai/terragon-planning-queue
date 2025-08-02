// Demonstration of the Terragon API flow
// This shows the expected request/response format

console.log('🚀 Terragon API Flow Demonstration\n');

// Step 1: Create Task Request
console.log('1️⃣ CREATE TASK REQUEST:');
console.log('POST /api/actions/terragon');
console.log('Body:', JSON.stringify({
  sessionToken: 'JTgr3pSv...(your-token)',
  message: 'Create a simple hello world function in JavaScript',
  githubRepoFullName: 'bhuman-ai/gesture_generator',
  repoBaseBranchName: 'main'
}, null, 2));

console.log('\n📨 EXPECTED RESPONSE:');
console.log(JSON.stringify({
  success: true,
  status: 200,
  taskId: '7de350d4-322b-4fbf-bd84-43b784f35c10',
  terragonUrl: 'https://www.terragonlabs.com/task/7de350d4-322b-4fbf-bd84-43b784f35c10',
  responseFormat: 'streaming',
  linesCount: 3
}, null, 2));

// Step 2: Stream Messages
console.log('\n\n2️⃣ GET MESSAGES (Server-Sent Events):');
console.log('GET /api/stream/7de350d4-322b-4fbf-bd84-43b784f35c10?token=...');
console.log('\n📨 STREAMING RESPONSE:');
console.log('data: {"type":"messages","taskId":"7de350d4-322b-4fbf-bd84-43b784f35c10","messages":[');
console.log('  {"type":"user","content":"Create a simple hello world function in JavaScript","timestamp":"2025-08-02T14:35:36.486Z"},');
console.log('  {"type":"assistant","content":"Here\'s a simple hello world function in JavaScript:\\n\\n```javascript\\nfunction helloWorld() {\\n  console.log(\\"Hello, World!\\");\\n}\\n\\n// Call the function\\nhelloWorld();\\n```","timestamp":"2025-08-02T14:35:38.123Z"}');
console.log('],"newMessages":[...],"totalMessages":2,"pollCount":1}\n');

// Step 3: Send Follow-up
console.log('\n3️⃣ SEND FOLLOW-UP MESSAGE:');
console.log('POST /api/task/7de350d4-322b-4fbf-bd84-43b784f35c10/message');
console.log('Body:', JSON.stringify({
  sessionToken: 'JTgr3pSv...(your-token)',
  message: 'Can you make it print the current date as well?'
}, null, 2));

console.log('\n📨 EXPECTED RESPONSE:');
console.log(JSON.stringify({
  success: true,
  status: 200,
  taskId: '7de350d4-322b-4fbf-bd84-43b784f35c10',
  message: 'Message sent successfully'
}, null, 2));

// Step 4: Get Updated Messages
console.log('\n\n4️⃣ GET UPDATED MESSAGES:');
console.log('GET /api/stream/7de350d4-322b-4fbf-bd84-43b784f35c10?token=...');
console.log('\n📨 NEW MESSAGE IN STREAM:');
console.log('data: {"type":"messages","messages":[');
console.log('  ...previous messages...,');
console.log('  {"type":"user","content":"Can you make it print the current date as well?","timestamp":"2025-08-02T14:36:45.123Z"},');
console.log('  {"type":"assistant","content":"Sure! Here\'s the updated function that also prints the current date:\\n\\n```javascript\\nfunction helloWorld() {\\n  console.log(\\"Hello, World!\\");\\n  console.log(\\"Current date:\\", new Date().toLocaleString());\\n}\\n\\n// Call the function\\nhelloWorld();\\n```","timestamp":"2025-08-02T14:36:47.456Z"}');
console.log('],"totalMessages":4}\n');

console.log('\n✅ Full flow demonstration complete!');
console.log('\n📝 Key Implementation Details:');
console.log('- Terragon uses chunked WebSocket format (0:metadata, 2:content, 1:json)');
console.log('- Messages are streamed via Server-Sent Events');
console.log('- Follow-up messages use the same task ID to maintain context');
console.log('- All requests require valid session token from Terragon cookies');