# Discord Webhook Setup (Not Bot Token)

## ⚠️ Important: We Need a Webhook URL, Not a Bot Token

The Meta-Agent notification system uses Discord **webhooks**, which are different from bot tokens. Webhooks are simpler and more secure for one-way notifications.

## 🔧 How to Create a Discord Webhook

### Step 1: Open Your Discord Server
1. Go to the Discord server where you want notifications
2. You must have "Manage Webhooks" permission

### Step 2: Create a Webhook
1. Right-click on the channel → **Edit Channel**
2. Go to **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Name it "Meta-Agent Notifications" (or any name you prefer)
5. (Optional) Add an avatar for the webhook

### Step 3: Copy the Webhook URL
1. Click **Copy Webhook URL**
2. It will look like this:
   ```
   https://discord.com/api/webhooks/1234567890/abcdefghijk...
   ```

### Step 4: Add to Vercel
1. Go to your Vercel dashboard
2. Navigate to Settings → Environment Variables
3. Add:
   ```
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
   ```

## 🤖 Bot Token vs Webhook

### Bot Tokens:
- Format: Three parts separated by dots
- Used for: Interactive Discord bots
- Requires: Complex bot setup, hosting, event handling
- Security: Can read messages, manage server

### Webhooks (What We Need):
- Format: `https://discord.com/api/webhooks/...`
- Used for: One-way notifications
- Requires: Just the URL
- Security: Can only send messages to one channel

## 🔒 Security Note

**NEVER share your bot token publicly!** I recommend you immediately:
1. Go to Discord Developer Portal
2. Regenerate your bot token
3. Update any applications using the old token

## 📝 Why Webhooks are Better for This Use Case

1. **Simpler**: No bot hosting required
2. **Secure**: Can only post to one channel
3. **Reliable**: Direct HTTP POST requests
4. **Easy**: 2-minute setup

## 🚀 Quick Test

Once you have your webhook URL, test it:

```bash
curl -X POST YOUR_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello from Meta-Agent!"}'
```

If you see the message in Discord, you're ready to go!