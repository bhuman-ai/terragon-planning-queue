# Discord Bot Setup for Interactive Meta-Agent

The Discord bot allows Meta-Agent to ask you questions during autonomous execution and use your responses to guide the Terragon agent.

## 🤖 How It Works

1. **Meta-Agent needs input** → Sends question to Discord
2. **You reply in Discord** → Bot captures your response
3. **Response sent to Terragon** → Task continues with your guidance
4. **"I don't know" option** → Available for every question

## 📋 Prerequisites

- Discord server where you're an admin
- Node.js 16+ installed locally

## 🚀 Setup Steps

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Name it "Meta-Agent Bot"
4. Go to **Bot** section
5. Click **Add Bot**
6. Under **Privileged Gateway Intents**, enable:
   - Message Content Intent
   - Server Members Intent

### 2. Get Bot Token

1. In the Bot section, click **Reset Token**
2. Copy the token (you'll need this for Vercel)
3. **IMPORTANT**: Keep this token secret!

### 3. Invite Bot to Your Server

1. Go to **OAuth2** → **URL Generator**
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Embed Links
   - Read Message History
   - Add Reactions
   - Use Slash Commands
4. Copy the generated URL
5. Open URL in browser and add to your server

### 4. Get Channel ID

1. In Discord, enable Developer Mode:
   - User Settings → Advanced → Developer Mode
2. Right-click your notification channel
3. Click **Copy ID**

### 5. Configure Vercel Environment

Add these environment variables to Vercel:

```bash
DISCORD_BOT_TOKEN=your-bot-token-here
DISCORD_CHANNEL_ID=your-channel-id-here
```

### 6. Run the Bot

The bot runs alongside the Meta-Agent. Add to your `package.json`:

```json
{
  "scripts": {
    "bot": "node lib/discord-bot/start.js",
    "dev": "concurrently \"next dev\" \"npm run bot\""
  }
}
```

## 💬 Using the Bot

### Responding to Questions

When Meta-Agent needs input, you'll see:

```
@YourName - Meta-Agent needs your input:

🤖 Task Requires Input
━━━━━━━━━━━━━━━━━━━━
Which authentication method should we implement?

Task: User Authentication System
Task ID: task-123

[🤷 I don't know]
```

**To respond:**
1. **Reply to the message** with your answer
2. **Click "I don't know"** if unsure

### Response Examples

**Specific answer:**
```
Reply: Use OAuth2 with Google and GitHub providers
```

**Detailed guidance:**
```
Reply: Implement JWT with refresh tokens. Store tokens in httpOnly cookies for security. Add rate limiting to prevent abuse.
```

**"I don't know" response:**
- Click the button, or
- Reply with "I don't know"

## 🔧 Advanced Configuration

### Multiple Notification Channels

Create different channels for different urgency levels:

```javascript
// In discord-bot/config.js
module.exports = {
  channels: {
    normal: 'channel-id-1',
    urgent: 'channel-id-2',
    errors: 'channel-id-3'
  }
};
```

### Custom Commands

Add slash commands for task management:

```javascript
// /status - Check active tasks
// /pause <taskId> - Pause a task
// /resume <taskId> - Resume a task
// /tasks - List all tasks
```

## 🐛 Troubleshooting

### Bot not responding?
1. Check bot is online in Discord
2. Verify bot has permissions in channel
3. Check Vercel logs for errors

### Messages not being sent?
1. Verify DISCORD_BOT_TOKEN is correct
2. Check DISCORD_CHANNEL_ID matches your channel
3. Ensure bot has Send Messages permission

### "I don't know" not working?
1. Update discord.js to latest version
2. Check bot has Add Reactions permission
3. Verify interaction handling is enabled

## 🔒 Security

- Bot token gives full control - keep it secret!
- Use environment variables, never commit tokens
- Regularly rotate bot token
- Limit bot permissions to minimum needed

## 📊 Monitoring

View bot activity in Vercel logs:
- Question sent notifications
- User responses received
- Task status updates
- Error notifications

## 🎯 Best Practices

1. **Respond promptly** - Tasks are paused waiting for input
2. **Be specific** - Clear instructions help Terragon
3. **Use "I don't know"** - Better than guessing
4. **Check context** - Read the full question before responding

## 🚀 Next Steps

1. Set up bot with your token
2. Test with a simple task
3. Monitor Discord for notifications
4. Provide feedback to improve questions

---

Need help? Check the [main README](./README.md) or create an issue!