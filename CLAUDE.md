# Terragon Planning Queue - Sacred Master Document (CLAUDE.md)

## 1. Project Overview
- **Vision:** Semi-autonomous slow steady conscious development using LLMs - enabling solo developers to build platforms and apps with AI assistance
- **Current Phase:** Active development - Meta-Agent system functional with Discord integration
- **Key Architecture:** Next.js frontend with Meta-Agent orchestration layer for Terragon AI task execution
- **Development Strategy:** Document-driven development, spec-driven development, comprehensive planning before execution

## 2. Project Structure

**⚠️ CRITICAL: AI agents MUST read this entire document before attempting any task to understand the complete technology stack, architecture, and sacred principles.**

### Technology Stack
- **Frontend**: Next.js 14.0.4, React 18.2.0
- **Backend**: Next.js API routes (serverless)
- **AI Integration**: 
  - Terragon AI (primary task executor)
  - Claude AI (meta-agent intelligence via @anthropic-ai/sdk)
  - Perplexity AI (research capabilities)
- **Communication**: Discord.js for bot integration
- **Storage**: Vercel KV for task persistence
- **Deployment**: Vercel 
  - **🚨 CRITICAL DEPLOYMENT TARGET**: https://vercel.com/bhuman/terragon-vercel/
  - **Team Account**: bhuman (NOT bhumanai hobby account)
  - **NEVER DEPLOY TO WRONG ACCOUNT** - Always verify deployment target

### Core Architecture
```
/
├── pages/
│   ├── index.js              # Main UI with task queue visualization
│   └── api/
│       ├── meta-agent/       # Meta-Agent orchestration endpoints
│       ├── calibration/      # Sacred document calibration system
│       ├── notifications/    # Discord notification system
│       └── cron/            # Autonomous task monitoring
├── components/
│   ├── PreResearchModal.js   # Dynamic pre-research questions
│   ├── PostResearchModal.js  # Informed post-research questions
│   ├── ProposalReviewModal.js # User approval workflow
│   ├── ProjectInterviewModal.js # Upfront project interview
│   └── CalibrationWizard.js  # Sacred CLAUDE.md generator
├── lib/
│   ├── meta-agent/          # Core Meta-Agent system
│   │   ├── index.js         # Sacred document enforcer
│   │   ├── task-decomposer.js # 100% AI-driven decomposition
│   │   ├── requirements.js   # Two-phase question system
│   │   └── research.js      # Perplexity integration
│   ├── discord-bot/         # Interactive Discord bot
│   ├── task-monitor.js      # Autonomous execution engine
│   └── claude-integrity.js  # CLAUDE.md drift detection
└── vercel.json             # Cron job configuration
```

## 3. Sacred Principles & AI Instructions

### ABSOLUTE RULES - NEVER VIOLATE
1. **NO SIMULATIONS** - Never simulate, mock, or fake any functionality
2. **NO FALLBACKS** - Get to the root of problems, never create workarounds
3. **NO TEMPLATES** - Task decomposition must be 100% AI-driven and dynamic
4. **NO ASSUMPTIONS** - Always check CLAUDE.md before asking questions
5. **ALWAYS REAL** - Every interaction, API call, and execution must be genuine

### General Instructions
- Your primary job is to manage context and enforce sacred principles
- Always read CLAUDE.md first before any task - it is the holy source of truth
- Check existing project documentation before generating questions
- Never commit to git without explicit user approval
- Never run servers - tell the user to run them for testing
- Quality is #1 priority - nothing else matters
- Be brutally honest about whether an idea is good or bad
- Design for semi-autonomous execution with user checkpoints

### Development Philosophy
- **Document-Driven Development**: CLAUDE.md drives all decisions
- **Spec-Driven Development**: Complete specifications before coding
- **Planning Phase Sacred**: Comprehensive research and planning required
- **Two-Phase Questions**: Basic questions → Research → Informed questions
- **User Sovereignty**: User approval required before execution
- **Autonomous Progress**: Continue working when user is offline
- **Interactive Decisions**: Pause and ask via Discord when needed

### Error Handling
- **NEVER SIMULATE**: If something fails, investigate root cause
- **NEVER MOCK SOLUTIONS**: Real implementations only
- **NEVER FALLBACK**: Fix the actual problem, not symptoms
- Get to ROOT of problem always
- If you cannot debug, research more
- Do not make fake solutions

### Security First
- Never expose session tokens or API keys
- Validate all inputs at boundaries
- Use secure Discord bot tokens (not webhooks)
- Keep secrets in environment variables only
- Never log sensitive conversation content

## 4. Meta-Agent System Architecture

### Core Components

#### 1. Task Decomposer (100% AI-Driven)
- NO predefined templates allowed
- Uses Claude Opus 4 (fallback to Sonnet 4)
- Breaks tasks into <10 minute micro-tasks
- Generates tasks based on:
  - CLAUDE.md sacred principles
  - Codebase analysis
  - Research findings
  - User requirements

#### 2. Two-Phase Question System
**Phase 1: Pre-Research Questions**
- Generated after checking CLAUDE.md
- Basic understanding questions
- Include "I don't know / Skip" option
- Support custom answers

**Phase 2: Post-Research Questions**
- Generated after Perplexity research
- Informed by codebase analysis
- Architecture and implementation focused
- Include "I don't know / Skip" option

#### 3. Research System
- Perplexity API for web research
- Codebase analysis for context
- Best practices investigation
- Never asks questions answered in CLAUDE.md

#### 4. Proposal & Approval
- Comprehensive plan presentation
- Micro-task breakdown with time estimates
- Risk analysis
- User must approve/reject/modify

#### 5. Autonomous Execution
- Polling-based task monitor
- Vercel cron jobs (every 5 minutes)
- Discord bot for interactive Q&A
- Pauses for user decisions
- Continues when user offline

### Discord Bot Integration
- **NOT WEBHOOKS** - Full Discord bot implementation
- Interactive Q&A during execution
- "I don't know" button on all questions
- Maintains conversation context
- Sends notifications for decisions needed

## 5. Calibration System

### Sacred CLAUDE.md Generation
1. **Repository Scan**: Analyze all documentation
2. **User Interview**: Dynamic AI-generated questions
3. **Document Generation**: Create comprehensive CLAUDE.md
4. **Cleanup**: Remove obsolete files per CLAUDE.md
5. **Validation**: User confirms sacred document

### Integrity Enforcement
- Monitor CLAUDE.md for tampering
- Detect drift from sacred principles
- Block tasks violating rules
- Alert on unauthorized changes
- Version control all updates

## 6. Task Execution Flow

1. **Project Interview** (if no CLAUDE.md exists)
2. **Task Submission** with Meta-Agent enabled
3. **Pre-Research Questions** (checking CLAUDE.md first)
4. **Research Phase** (Perplexity + codebase analysis)
5. **Post-Research Questions** (informed by research)
6. **Proposal Generation** with micro-tasks
7. **User Approval** required
8. **Terragon Execution** begins
9. **Autonomous Monitoring** via cron
10. **Discord Interactions** when decisions needed

## 7. Environment Requirements

### Required API Keys
```
CLAUDE_API_KEY        # Anthropic API key for Meta-Agent
PERPLEXITY_API_KEY    # Perplexity for research
DISCORD_BOT_TOKEN     # Discord bot (not webhook!)
DISCORD_CHANNEL_ID    # Channel for notifications
CRON_SECRET          # Secret for cron job auth
```

### Vercel Configuration
- Must use TEAM account (not hobby)
- Cron jobs enabled for monitoring
- Environment variables configured
- Proper domain setup

## 8. Success Metrics

- **User Satisfaction**: Primary metric
- **Total Time Saved**: Automation efficiency
- **Task Completion Rate**: Autonomous success
- **Quality Score**: No compromises on quality
- **Context Preservation**: Never lose state

## 9. Future Enhancements

- **Queueing System**: Multiple task management
- **Automatic Decision Making**: Reduce interruptions
- **Discord Notifications**: Enhanced interaction
- **ElevenLabs Integration**: Conversational agent
- **Memory System**: Long-term context retention

## 10. Development Guidelines

### Before Starting Any Task
1. Read this entire CLAUDE.md document
2. Check for updates to sacred principles
3. Verify no rule violations
4. Load project context
5. Plan comprehensively

### During Development
- Quality over speed always
- Real implementations only
- Test everything thoroughly
- Document decisions
- Follow two-phase workflow

### Error Recovery
- Never mock failures
- Investigate root causes
- Research solutions
- Ask user if stuck
- No workarounds

## 11. Sacred Enforcement

This document is **HOLY** and **SACRED**. Any AI agent working on this project MUST:

1. Load CLAUDE.md before any operation
2. Check actions against sacred principles
3. Refuse tasks violating rules
4. Alert on drift detection
5. Maintain document integrity

**REMEMBER**: This is a living document. It guides all development. It is the single source of truth. Violating its principles is forbidden.

## 🚨 CRITICAL DEPLOYMENT INFORMATION

### Sacred Deployment Target
- **ONLY DEPLOY TO**: https://vercel.com/bhuman/terragon-vercel/
- **Team Account**: bhuman (NEVER use bhumanai hobby account)
- **Repository**: bhuman-ai/terragon-planning-queue
- **Environment**: Production deployment with proper API keys

### Deployment Verification Checklist
1. ✅ Verify URL shows "bhuman/terragon-vercel" 
2. ✅ Check team account is "bhuman" not "bhumanai"
3. ✅ Confirm environment variables are set (CLAUDE_API_KEY, PERPLEXITY_API_KEY)
4. ✅ Test deployment after push

**⚠️ FAILURE TO FOLLOW THIS RESULTS IN BROKEN DEPLOYMENTS AND WASTED TIME**

---

*Generated: 2025-08-02*
*Version: 1.0.1*
*Status: SACRED - DO NOT MODIFY WITHOUT APPROVAL*