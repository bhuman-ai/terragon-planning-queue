# Discord Notifications Setup for Meta-Agent

The Meta-Agent will send Discord messages to your specified channel whenever it needs your input during autonomous task execution.

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Discord Webhook
1. Open your Discord server
2. Go to the channel where you want notifications
3. Click the gear icon (Edit Channel) → Integrations → Webhooks
4. Click "New Webhook"
5. Give it a name like "Meta-Agent Bot"
6. Copy the Webhook URL (looks like: `https://discord.com/api/webhooks/123456/abcdef...`)

### Step 2: Add to Environment Variables
Add this to your Vercel environment variables:
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL_HERE
```

### Step 3: Deploy
Deploy to Vercel and you're done! 🎉

## 📱 How It Works

1. **Task Execution**: When you approve a Meta-Agent proposal, the task begins autonomous execution
2. **Decision Point**: If the AI encounters something requiring your input, it pauses the task
3. **Discord Alert**: You receive a Discord embed message with:
   - Task title and ID
   - What decision/input is needed
   - Direct link to resume the task
4. **Resume Task**: Click the link in Discord to provide input and continue

## 🔧 Testing Discord Notifications

Test the Discord endpoint directly:

```bash
curl -X POST https://your-deployment.vercel.app/api/notifications/discord \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test notification from Meta-Agent",
    "taskId": "test-123",
    "taskTitle": "Test Task",
    "urgency": "normal"
  }'
```

## 🎨 Discord Message Format

All Discord messages from Meta-Agent appear as rich embeds:
- **Blue embed**: Normal notifications
- **Red embed**: Urgent notifications requiring immediate attention
- **Fields**: Task name, ID, and direct resume link
- **Timestamp**: When the notification was sent
- **Footer**: Meta-Agent branding

## 🔒 Security Notes

- Discord webhooks are secure and rate-limited
- Each notification includes a unique task ID
- Resume links include authentication
- Webhooks can be revoked anytime from Discord

## 🚨 Troubleshooting

If you're not receiving Discord messages:
1. Check Vercel logs for notification attempts
2. Verify DISCORD_WEBHOOK_URL is set correctly
3. Test the webhook URL directly in Discord
4. Check if Discord channel permissions allow webhooks
5. Look for rate limit errors (Discord allows 30 messages/minute)

## 💡 Pro Tips

1. **Dedicated Channel**: Create a dedicated #meta-agent channel for notifications
2. **Mobile Notifications**: Enable Discord mobile notifications for the channel
3. **Multiple Webhooks**: You can create multiple webhooks for different urgency levels
4. **Custom Avatar**: Upload a custom avatar for your webhook in Discord settings