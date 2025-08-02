# Terragon Planning Queue with Meta-Agent

AI-powered autonomous task planning and execution with GitHub integration.

## 🚀 Features

### Core Platform
- **Terragon AI Integration**: Direct connection to Terragon's advanced AI
- **Task Planning Queue**: Visual phase tracking (🌱 Seedling → 🌿 Growing → 🌳 Complete)
- **GitHub Integration**: Automatic issue creation and management
- **Real-time Updates**: Live conversation streaming with Terragon
- **Mobile Responsive**: Works seamlessly on all devices

### 🧠 Meta-Agent (NEW)
- **Two-Phase Intelligence**: Pre-research and post-research question system
- **Autonomous Research**: Perplexity-powered web research before planning
- **Smart Task Decomposition**: Breaks complex tasks into <10 minute micro-tasks
- **User Approval Workflow**: Review and approve plans before execution
- **Autonomous Execution**: Continues working even when you're offline
- **Discord Notifications**: Get alerts when Meta-Agent needs your input

## 📦 Quick Deploy to Vercel

### 1. Prerequisites
- GitHub account
- Vercel account (Team plan for cron jobs)
- Discord server (for notifications)
- API Keys:
  - Claude API key (from Anthropic)
  - Perplexity API key (for research)

### 2. Deploy Steps

1. **Fork/Clone this repository**
   ```bash
   git clone https://github.com/yourusername/terragon-planning-queue.git
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Select your TEAM account (not hobby)

3. **Set Environment Variables**
   ```
   CLAUDE_API_KEY=your-claude-api-key
   PERPLEXITY_API_KEY=your-perplexity-api-key
   DISCORD_WEBHOOK_URL=your-discord-webhook-url
   CRON_SECRET=your-random-secret-string
   ```

4. **Configure Discord** (See [DISCORD_SETUP.md](./DISCORD_SETUP.md))

## 🎯 How to Use

### 1. Get Terragon Session Token
See [TERRAGON_SESSION_GUIDE.md](./TERRAGON_SESSION_GUIDE.md) for detailed instructions.

### 2. Connect to Terragon
1. Visit your deployment URL
2. Paste your session token
3. Click "Connect to Terragon"

### 3. Configure GitHub
1. Enter your GitHub organization/username
2. Enter repository name
3. Click "Save GitHub Settings"

### 4. Enable Meta-Agent
1. Check "🧠 Enable Meta-Agent (BETA)"
2. Submit a task to the planning queue
3. Answer the two-phase questions
4. Review and approve the proposal

## 🔄 Meta-Agent Workflow

### Phase 1: Pre-Research Questions
Basic questions to understand your needs:
- Task scope and urgency
- Who will be affected
- Constraints and requirements
- Additional context

### Phase 2: Research & Analysis
Meta-Agent performs:
- Web research via Perplexity
- Codebase analysis
- Best practices research
- Architecture recommendations

### Phase 3: Post-Research Questions
Informed questions based on research:
- Implementation approach
- Integration strategy
- Architecture decisions

### Phase 4: Proposal Review
Review the comprehensive plan:
- Requirements summary
- Micro-task breakdown
- Timeline estimates
- Risk analysis

### Phase 5: Autonomous Execution
Once approved:
- Task begins execution with Terragon
- Runs autonomously via cron jobs
- Pauses when decisions needed
- Sends Discord notifications

## 📁 Project Structure

```
/
├── pages/
│   ├── index.js              # Main UI
│   └── api/
│       ├── meta-agent/       # Meta-Agent endpoints
│       ├── notifications/    # Discord notifications
│       └── cron/            # Task monitoring
├── components/
│   ├── PreResearchModal.js   # Phase 1 questions
│   ├── PostResearchModal.js  # Phase 3 questions
│   └── ProposalReviewModal.js # Proposal review UI
├── lib/
│   ├── meta-agent/          # Core Meta-Agent logic
│   └── task-monitor.js      # Autonomous execution
└── vercel.json             # Cron job configuration
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Open browser
http://localhost:3001
```

## 🔐 Security

- Session tokens stored in browser localStorage
- API keys never exposed to client
- All API routes authenticated
- Discord webhooks are secure
- Cron jobs protected by secret

## 📊 Monitoring

View logs in Vercel dashboard:
- Function logs for API calls
- Cron logs for task monitoring
- Discord webhook delivery status

## 🐛 Troubleshooting

### Meta-Agent not working?
1. Check API keys are set correctly
2. Verify you're on Vercel Team plan
3. Check browser console for errors

### Not receiving Discord notifications?
1. Verify webhook URL is correct
2. Check Discord channel permissions
3. Look for rate limit errors

### Tasks not executing autonomously?
1. Ensure cron jobs are enabled
2. Check CRON_SECRET matches
3. View cron logs in Vercel

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 🆘 Support

- Create an issue in this repository
- Check existing issues for solutions
- Review documentation in `/docs`

---

Built with ❤️ using Next.js, Vercel, and Terragon AI