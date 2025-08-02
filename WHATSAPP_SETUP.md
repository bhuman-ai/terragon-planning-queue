# WhatsApp Notifications Setup for Meta-Agent

The Meta-Agent will send WhatsApp messages to **+1 929-276-2732** whenever it needs your input during autonomous task execution.

## 🚀 Quick Setup Options

### Option 1: Twilio WhatsApp (Recommended)
1. Sign up for [Twilio](https://www.twilio.com)
2. Get a WhatsApp-enabled Twilio phone number
3. Add these environment variables to Vercel:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_WHATSAPP_NUMBER=+14155238886  # Twilio's sandbox number
   WHATSAPP_USER_NUMBER=+19292762732
   ```
4. Join Twilio's WhatsApp sandbox by sending "join <your-sandbox-keyword>" to the Twilio number

### Option 2: WhatsApp Business API
1. Set up [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
2. Create a Facebook App with WhatsApp product
3. Add these environment variables:
   ```
   WHATSAPP_API_TOKEN=your_facebook_api_token
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WHATSAPP_USER_NUMBER=+19292762732
   ```

### Option 3: Custom WhatsApp Service
Use any WhatsApp messaging service that provides a webhook:
1. Set up your preferred service (e.g., WhatsApp Web automation, ChatAPI, etc.)
2. Add the webhook URL:
   ```
   WHATSAPP_WEBHOOK_URL=https://your-whatsapp-service.com/send
   WHATSAPP_USER_NUMBER=+19292762732
   ```

### Option 4: WhatsApp MCP Server (Future)
When [WhatsApp MCP](https://github.com/lharries/whatsapp-mcp) is installed:
1. Install the MCP server locally
2. Set `MCP_WHATSAPP_ENABLED=true` in Vercel

## 📱 How It Works

1. **Task Execution**: When you approve a Meta-Agent proposal, the task begins autonomous execution
2. **Decision Point**: If the AI encounters something requiring your input, it pauses the task
3. **WhatsApp Alert**: You receive a WhatsApp message like:
   ```
   🤖 Meta-Agent Alert
   
   Task: Implement user authentication
   Task ID: task-123
   Action Needed: Should we use OAuth2 or JWT for authentication?
   
   Resume at: https://terragon-vercel.vercel.app/task/task-123/resume
   ```
4. **Resume Task**: Click the link or go to the Task Monitor dashboard to provide input

## 🔧 Testing WhatsApp Notifications

Test the WhatsApp endpoint directly:

```bash
curl -X POST https://terragon-vercel.vercel.app/api/notifications/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test notification from Meta-Agent",
    "taskId": "test-123",
    "taskTitle": "Test Task",
    "urgency": "normal"
  }'
```

## 🎯 Integration Points

The WhatsApp notifications are automatically triggered when:
- Task Monitor detects a task needs user input
- Meta-Agent encounters ambiguous decisions
- Errors occur that require human intervention
- Tasks complete successfully (optional)

## 📊 Notification Channels Priority

1. **WhatsApp** (primary) - Immediate alerts to +1 929-276-2732
2. **Webhook** (secondary) - For custom integrations
3. **Email** (tertiary) - If configured
4. **SMS** (urgent only) - For critical issues

## 🔒 Security Notes

- Your phone number is never exposed in logs
- Messages are sent over secure HTTPS
- Each notification includes a unique task ID for tracking
- Resume links include authentication tokens

## 🚨 Troubleshooting

If you're not receiving WhatsApp messages:
1. Check Vercel logs for notification attempts
2. Verify environment variables are set correctly
3. Ensure your WhatsApp number is in international format (+19292762732)
4. Test the `/api/notifications/whatsapp` endpoint directly
5. Check if you need to join a sandbox (Twilio) or whitelist numbers

## 📝 Message Format

All WhatsApp messages from Meta-Agent follow this format:
```
🤖 Meta-Agent Alert
[🚨 URGENT - if urgent]

Task: {task title}
Task ID: {unique id}
Action Needed: {specific question or issue}

Resume at: {direct link to resume}

Reply "HELP" for more info.
```

This ensures you always know:
- What task needs attention
- Why it was paused
- How to quickly resume it