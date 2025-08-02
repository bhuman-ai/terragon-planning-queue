# Terragon Planning Queue - Vercel Deployment

AI-powered task planning with GitHub integration, deployed on Vercel.

## Features

- 🚀 Direct integration with Terragon's AI
- 📋 Task planning queue with phase tracking (🌱→🌿→🌳)
- 🔗 Automatic GitHub issue creation
- 📱 Mobile-friendly, works anywhere
- 🔒 Secure session management

## Quick Start

### Deploy to Vercel

1. Push this code to a GitHub repository
2. Connect to Vercel and import the repository
3. Deploy with default settings (no environment variables needed)
4. Access your deployment URL

### Get Terragon Session Token

1. Log in to [terragonlabs.com](https://terragonlabs.com)
2. Open Chrome DevTools (F12)
3. Go to Application → Cookies → terragonlabs.com
4. Copy the `__session` cookie value

### Use the App

1. Visit your Vercel deployment URL
2. Paste your session token and click "Connect to Terragon"
3. Configure GitHub repository settings
4. Start submitting tasks to the planning queue!

## How It Works

1. **Planning Phase**: Submit tasks to the queue
2. **AI Processing**: Terragon analyzes and creates detailed plans
3. **GitHub Integration**: Plans are converted to GitHub issues
4. **Execution**: Terragon picks up issues with @terragon-labs mentions

## API Routes

- `/api/terragon` - Proxy for Terragon API calls
- `/api/validate-session` - Validate session tokens

## Security Notes

- Session tokens are stored locally in browser
- API routes handle authentication securely
- No credentials are stored on the server

## Development

```bash
npm install
npm run dev
```

Visit http://localhost:3000