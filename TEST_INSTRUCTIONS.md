# Testing Terragon Full Flow

## Prerequisites

1. Get your Terragon session token:
   - Log in to https://www.terragonlabs.com
   - Open DevTools (F12)
   - Go to Application → Cookies
   - Find `__Secure-better-auth.session_token`
   - Copy the value

## Testing Methods

### Method 1: Web UI Test Page

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to http://localhost:3000/test

3. Enter your session token in the configuration section

4. Follow the numbered steps:
   - **Step 1**: Click "Create Task" to create a new Terragon task
   - **Step 2**: Click "Get Messages" to fetch the AI's response
   - **Step 3**: Click "Send Message" to send a follow-up message

### Method 2: Main Application

1. Navigate to http://localhost:3000

2. Enter your session token and connect to Terragon

3. Create a new task in the planning queue

4. Click "Open Chat" to view the conversation

5. Send follow-up messages in the chat interface

### Method 3: Command Line Test

1. Edit `test-terragon-flow.js` and update `SESSION_TOKEN`

2. Run the test:
   ```bash
   node test-terragon-flow.js
   ```

## Expected Flow

1. **Task Creation**: 
   - Creates a new task on Terragon
   - Returns a task ID and URL
   - Initial message is sent to the AI

2. **Get Responses**:
   - Fetches messages from the task
   - Parses Terragon's streaming format
   - Shows user and assistant messages

3. **Send Follow-up**:
   - Sends a new message to the existing task
   - AI responds to the follow-up
   - Conversation continues in the same thread

## Troubleshooting

### "Session token required" error
- Make sure you've copied the full token value
- Check that the token hasn't expired (usually lasts 24-48 hours)

### "Server action not found" error
- The session token might be invalid
- Try getting a fresh token from Terragon

### No messages appearing
- Wait a few seconds for the AI to respond
- Check the browser console for errors
- Try refreshing the page

### Messages not updating
- The streaming connection might have dropped
- Refresh the page to reconnect
- Check your internet connection

## API Endpoints

- `POST /api/actions/terragon` - Create new task
- `GET /api/stream/[taskId]` - Stream task messages (SSE)
- `POST /api/task/[taskId]/message` - Send message to task
- `POST /api/validate-session` - Validate session token

## Response Format

Terragon uses a custom streaming format:
- Line starting with `0:` - Initial metadata
- Line starting with `2:` - Streaming content chunks
- Line starting with `1:` - Final JSON data with full message history