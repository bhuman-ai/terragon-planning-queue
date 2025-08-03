# Claude.md Collaboration System - Developer Integration Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [Core Workflows](#core-workflows)
4. [Integration Patterns](#integration-patterns)
5. [Code Examples](#code-examples)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)
8. [SDK Integration](#sdk-integration)

## Quick Start

### Prerequisites
- Node.js 18+ or equivalent runtime
- Valid API endpoint access
- Agent authentication credentials (for automated systems)

### Basic Setup

```javascript
// Initialize the collaboration client
import { CollaborationClient } from '@terragon/collaboration-sdk';

const client = new CollaborationClient({
  baseUrl: 'https://terragon-vercel.vercel.app/api',
  agentAuth: process.env.AGENT_AUTH_TOKEN, // For automated systems
  timeout: 30000
});

// For browser-based integration
const browserClient = new CollaborationClient({
  baseUrl: '/api', // Relative URL for same-origin requests
  sessionBased: true // Use session authentication
});
```

### 30-Second Integration

```javascript
// 1. Initialize a collaboration session
const session = await client.initializeSession({
  userSettings: {
    name: "Developer Name",
    email: "dev@example.com",
    preferences: {
      aiAssistanceLevel: "collaborative",
      autoSave: true
    }
  },
  githubConfig: {
    repository: "org/repo",
    branch: "feature/claude-md",
    token: process.env.GITHUB_TOKEN
  }
});

// 2. Start ideation with AI assistance
const aiResponse = await client.ideationChat({
  sessionId: session.sessionId,
  message: "Help me create a comprehensive CLAUDE.md for my project",
  aiMode: "collaborative"
});

// 3. Create a draft
const draft = await client.createDraft({
  sessionId: session.sessionId,
  title: "Project CLAUDE.md",
  content: "# My Project\n\n## Overview\n...",
});

console.log(`Session: ${session.sessionId}`);
console.log(`Draft: ${draft.draftId}`);
console.log(`AI suggested: ${aiResponse.suggestions.join(', ')}`);
```

## Authentication

### Agent Authentication (Automated Systems)

For server-to-server or automated agent integration:

```javascript
// Generate agent authentication token
const agentAuth = await client.security.generateAgentToken({
  agentId: 'my-automation-system',
  permissions: ['read', 'write', 'execute'],
  expiresIn: '24h'
});

// Use in requests
const response = await fetch('/api/collaboration/session/initialize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-Auth': agentAuth.token
  },
  body: JSON.stringify(sessionData)
});
```

### Session Authentication (User Systems)

For user-facing applications:

```javascript
// Initialize session (no auth token needed for initialization)
const session = await client.initializeSession(userConfig);

// All subsequent requests use sessionId
const draft = await client.createDraft({
  sessionId: session.sessionId,
  // ... other parameters
});
```

### Security Token Rotation

```javascript
// Automatic token rotation for long-running systems
class SecureCollaborationClient {
  constructor(config) {
    this.config = config;
    this.tokenRotationInterval = 23 * 60 * 60 * 1000; // 23 hours
    this.startTokenRotation();
  }

  async rotateToken() {
    try {
      const newToken = await this.generateAgentToken();
      this.config.agentAuth = newToken.token;
      console.log('🔄 Agent token rotated successfully');
    } catch (error) {
      console.error('❌ Token rotation failed:', error);
    }
  }

  startTokenRotation() {
    setInterval(() => this.rotateToken(), this.tokenRotationInterval);
  }
}
```

## Core Workflows

### 1. Complete Collaboration Workflow

```javascript
class ClaudeMdCollaboration {
  constructor(client) {
    this.client = client;
  }

  async createDocument(projectConfig) {
    // Phase 1: Initialize session
    const session = await this.client.initializeSession({
      userSettings: projectConfig.userSettings,
      githubConfig: projectConfig.githubConfig,
      initialMode: 'ideation'
    });

    console.log(`🚀 Session initialized: ${session.sessionId}`);

    // Phase 2: Ideation with AI
    const ideationResults = await this.ideationPhase(session.sessionId, projectConfig);
    
    // Phase 3: Task orchestration
    const orchestrationResults = await this.orchestrationPhase(session.sessionId, ideationResults);
    
    // Phase 4: Execution monitoring
    const executionResults = await this.executionPhase(session.sessionId, orchestrationResults);
    
    // Phase 5: Merge and finalize
    const finalDocument = await this.mergePhase(session.sessionId, executionResults);

    return {
      sessionId: session.sessionId,
      finalDocument,
      metrics: {
        totalTime: Date.now() - session.createdAt,
        phases: ['ideation', 'orchestration', 'execution', 'merge']
      }
    };
  }

  async ideationPhase(sessionId, config) {
    console.log('💡 Starting ideation phase...');
    
    // Interactive brainstorming
    const brainstormResponse = await this.client.ideationChat({
      sessionId,
      message: `Help me create a CLAUDE.md for: ${config.projectDescription}`,
      aiMode: 'collaborative'
    });

    // Create initial draft based on AI suggestions
    const initialDraft = await this.client.createDraft({
      sessionId,
      title: 'Initial CLAUDE.md Draft',
      content: await this.generateInitialContent(brainstormResponse),
      description: 'AI-assisted initial draft'
    });

    // Iterative refinement
    let currentDraft = initialDraft;
    for (let iteration = 0; iteration < config.maxIterations || 3; iteration++) {
      const refinementResponse = await this.client.ideationChat({
        sessionId,
        message: `Please review and suggest improvements for this section: ${config.focusAreas[iteration]}`,
        draftContent: currentDraft.content,
        aiMode: 'critique'
      });

      if (refinementResponse.proposedChanges.length > 0) {
        currentDraft = await this.client.updateDraft({
          draftId: currentDraft.draftId,
          content: this.applyChanges(currentDraft.content, refinementResponse.proposedChanges)
        });
      }
    }

    return {
      finalDraft: currentDraft,
      iterations: config.maxIterations || 3,
      aiSuggestions: brainstormResponse.suggestions
    };
  }

  async orchestrationPhase(sessionId, ideationResults) {
    console.log('🎯 Starting orchestration phase...');

    // Decompose implementation into micro-tasks
    const decomposition = await this.client.orchestrateTask({
      sessionId,
      taskDescription: 'Implement and deploy the finalized CLAUDE.md document',
      context: ideationResults.finalDraft.content,
      requirements: {
        targetDuration: '8 minutes',
        maxSteps: 15,
        includeValidation: true,
        generateDependencies: true
      }
    });

    // Validate task decomposition
    if (decomposition.steps.length === 0) {
      throw new Error('Task decomposition failed - no steps generated');
    }

    console.log(`📋 Generated ${decomposition.steps.length} tasks`);
    console.log(`⏱️ Total estimated time: ${decomposition.metadata.estimatedTotalTime / 60000} minutes`);

    return decomposition;
  }

  async executionPhase(sessionId, orchestrationResults) {
    console.log('⚡ Starting execution phase...');

    const executionResults = [];

    // Execute tasks with checkpoints
    for (const step of orchestrationResults.steps) {
      try {
        // Create atomic checkpoint
        const checkpoint = await this.client.createCheckpoint({
          sessionId,
          stepId: step.id,
          metadata: {
            agent: step.assignedAgent,
            estimatedDuration: step.estimatedDuration
          }
        });

        // Execute with monitoring
        const execution = await this.client.executeCheckpoint({
          checkpointId: checkpoint.checkpointId,
          executionParams: {
            step: step,
            context: orchestrationResults
          },
          monitoringConfig: {
            realTimeUpdates: true,
            maxExecutionTime: 10 * 60 * 1000 // 10 minutes max
          }
        });

        // Monitor progress
        await this.monitorExecution(execution.executionId, step.estimatedDuration);

        executionResults.push({
          stepId: step.id,
          checkpointId: checkpoint.checkpointId,
          executionId: execution.executionId,
          status: 'completed'
        });

        console.log(`✅ Completed: ${step.title}`);

      } catch (error) {
        console.error(`❌ Failed: ${step.title}`, error);
        executionResults.push({
          stepId: step.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return executionResults;
  }

  async mergePhase(sessionId, executionResults) {
    console.log('🔀 Starting merge phase...');

    // Check for conflicts
    const conflicts = await this.client.detectMergeConflicts({
      sessionId,
      originalHash: 'original_content_hash',
      modifiedHash: 'modified_content_hash'
    });

    if (conflicts.hasConflicts) {
      console.log(`⚠️ Found ${conflicts.conflicts.length} conflicts`);

      // Resolve conflicts automatically where possible
      const resolutions = conflicts.conflicts.map(conflict => ({
        conflictId: conflict.id,
        resolution: conflict.resolution === 'automatic' ? 'accept_modified' : 'manual_merge',
        customContent: conflict.resolution === 'manual' ? conflict.suggestions[0] : undefined
      }));

      const mergeResult = await this.client.resolveMergeConflicts({
        sessionId,
        conflicts: resolutions,
        resolutionStrategy: 'balanced',
        validateIntegrity: true
      });

      return mergeResult.mergedContent;
    }

    // No conflicts - return final merged content
    const finalContent = await this.client.getFinalContent(sessionId);
    return finalContent;
  }
}
```

### 2. Real-time Collaboration

```javascript
class RealtimeCollaboration {
  constructor(client) {
    this.client = client;
    this.websocket = null;
    this.eventHandlers = new Map();
  }

  async connect(sessionId) {
    const wsUrl = `wss://terragon-vercel.vercel.app/api/collaboration/sync/websocket?sessionId=${sessionId}&agentAuth=${this.client.agentAuth}`;
    
    this.websocket = new WebSocket(wsUrl);

    this.websocket.onopen = () => {
      console.log('🔗 Real-time collaboration connected');
      this.emit('connected');
    };

    this.websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.websocket.onclose = () => {
      console.log('📡 Real-time collaboration disconnected');
      this.emit('disconnected');
      // Auto-reconnect logic
      setTimeout(() => this.connect(sessionId), 5000);
    };
  }

  handleMessage(data) {
    switch (data.type) {
      case 'draft_update':
        this.emit('draftUpdate', data.payload);
        break;
      case 'execution_progress':
        this.emit('executionProgress', data.payload);
        break;
      case 'conflict_detected':
        this.emit('conflictDetected', data.payload);
        break;
      case 'user_joined':
        this.emit('userJoined', data.payload);
        break;
      case 'phase_transition':
        this.emit('phaseTransition', data.payload);
        break;
    }
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  // Send real-time updates
  sendUpdate(type, payload) {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type, payload }));
    }
  }
}

// Usage example
const realtime = new RealtimeCollaboration(client);

realtime.on('draftUpdate', (update) => {
  console.log('📝 Draft updated:', update.title);
  // Update UI or trigger actions
});

realtime.on('executionProgress', (progress) => {
  console.log(`⚡ Progress: ${progress.completionPercentage}%`);
  // Update progress bars
});

realtime.on('conflictDetected', (conflict) => {
  console.log('⚠️ Conflict detected:', conflict.description);
  // Show conflict resolution UI
});

await realtime.connect(sessionId);
```

## Integration Patterns

### 1. CI/CD Integration

```javascript
// GitHub Actions workflow integration
class GitHubActionsIntegration {
  constructor(collaborationClient) {
    this.client = collaborationClient;
  }

  async updateClaudeMdOnPush() {
    // Triggered by GitHub webhook or action
    const session = await this.client.initializeSession({
      userSettings: {
        name: 'GitHub Actions Bot',
        email: 'actions@github.com'
      },
      githubConfig: {
        repository: process.env.GITHUB_REPOSITORY,
        branch: process.env.GITHUB_REF_NAME,
        token: process.env.GITHUB_TOKEN
      }
    });

    // Analyze current CLAUDE.md and suggest improvements
    const analysis = await this.client.ideationChat({
      sessionId: session.sessionId,
      message: 'Analyze the current CLAUDE.md and suggest improvements based on recent code changes',
      aiMode: 'research'
    });

    if (analysis.proposedChanges.length > 0) {
      // Create PR with suggested improvements
      await this.createPullRequest(session.sessionId, analysis);
    }
  }

  async createPullRequest(sessionId, analysis) {
    // Implementation for creating PR with suggested changes
    const branchName = `claude-md-update-${Date.now()}`;
    
    // Create and execute improvement tasks
    const tasks = await this.client.orchestrateTask({
      sessionId,
      taskDescription: 'Update CLAUDE.md based on AI analysis',
      context: analysis.response
    });

    // Execute tasks and create PR
    // ... implementation details
  }
}
```

### 2. Slack/Discord Bot Integration

```javascript
class SlackBotIntegration {
  constructor(collaborationClient, slackClient) {
    this.client = collaborationClient;
    this.slack = slackClient;
  }

  async handleSlashCommand(command, channelId, userId) {
    switch (command.text) {
      case '/claude-md start':
        return await this.startCollaborationSession(channelId, userId);
      case '/claude-md status':
        return await this.getSessionStatus(channelId);
      case '/claude-md help':
        return await this.sendHelpMessage(channelId);
    }
  }

  async startCollaborationSession(channelId, userId) {
    try {
      const session = await this.client.initializeSession({
        userSettings: {
          name: await this.getUserName(userId),
          email: await this.getUserEmail(userId)
        },
        githubConfig: {
          repository: await this.getChannelRepository(channelId),
          token: process.env.GITHUB_TOKEN
        }
      });

      await this.slack.chat.postMessage({
        channel: channelId,
        text: `🚀 CLAUDE.md collaboration session started!`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Session ID:* \`${session.sessionId}\`\n*Status:* Ready for ideation`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Open Collaboration Hub' },
                url: `https://terragon-vercel.vercel.app/collaboration?session=${session.sessionId}`
              }
            ]
          }
        ]
      });

      return session;
    } catch (error) {
      await this.slack.chat.postMessage({
        channel: channelId,
        text: `❌ Failed to start collaboration session: ${error.message}`
      });
    }
  }
}
```

### 3. VS Code Extension Integration

```javascript
// VS Code extension integration
class VSCodeExtension {
  constructor() {
    this.client = new CollaborationClient({
      baseUrl: 'https://terragon-vercel.vercel.app/api',
      agentAuth: vscode.workspace.getConfiguration('terragon').get('agentToken')
    });
  }

  async activateCollaboration() {
    // Create webview panel for collaboration
    const panel = vscode.window.createWebviewPanel(
      'terragonCollab',
      'CLAUDE.md Collaboration',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // Initialize session
    const session = await this.client.initializeSession({
      userSettings: {
        name: await this.getUserName(),
        email: await this.getUserEmail()
      },
      githubConfig: {
        repository: await this.getGitRepository(),
        token: await this.getGitHubToken()
      }
    });

    // Load collaboration UI
    panel.webview.html = this.getWebviewContent(session.sessionId);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'ideationChat':
          const response = await this.client.ideationChat({
            sessionId: session.sessionId,
            message: message.text,
            aiMode: message.mode
          });
          panel.webview.postMessage({ type: 'chatResponse', data: response });
          break;
      }
    });
  }
}
```

## Code Examples

### Python Integration

```python
import asyncio
import aiohttp
from typing import Dict, Any, Optional

class CollaborationClient:
    def __init__(self, base_url: str, agent_auth: Optional[str] = None):
        self.base_url = base_url
        self.agent_auth = agent_auth
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def initialize_session(self, user_settings: Dict[str, Any], 
                                github_config: Dict[str, Any]) -> Dict[str, Any]:
        headers = {'Content-Type': 'application/json'}
        if self.agent_auth:
            headers['X-Agent-Auth'] = self.agent_auth

        async with self.session.post(
            f"{self.base_url}/collaboration/session/initialize",
            json={
                "userSettings": user_settings,
                "githubConfig": github_config
            },
            headers=headers
        ) as response:
            return await response.json()

    async def ideation_chat(self, session_id: str, message: str, 
                           ai_mode: str = "collaborative") -> Dict[str, Any]:
        headers = {'Content-Type': 'application/json'}
        if self.agent_auth:
            headers['X-Agent-Auth'] = self.agent_auth

        async with self.session.post(
            f"{self.base_url}/collaboration/ideation/chat",
            json={
                "sessionId": session_id,
                "message": message,
                "aiMode": ai_mode,
                "draftContent": ""
            },
            headers=headers
        ) as response:
            return await response.json()

# Usage example
async def main():
    async with CollaborationClient(
        "https://terragon-vercel.vercel.app/api",
        agent_auth="your-agent-token"
    ) as client:
        
        session = await client.initialize_session(
            user_settings={
                "name": "Python Developer",
                "email": "dev@example.com",
                "preferences": {
                    "aiAssistanceLevel": "collaborative"
                }
            },
            github_config={
                "repository": "my-org/my-project",
                "token": "github-token"
            }
        )
        
        response = await client.ideation_chat(
            session["sessionId"],
            "Help me create a Python-focused CLAUDE.md",
            "collaborative"
        )
        
        print(f"AI Response: {response['response']}")

if __name__ == "__main__":
    asyncio.run(main())
```

### Go Integration

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type CollaborationClient struct {
    BaseURL   string
    AgentAuth string
    Client    *http.Client
}

type SessionConfig struct {
    UserSettings  UserSettings  `json:"userSettings"`
    GitHubConfig  GitHubConfig  `json:"githubConfig"`
    InitialMode   string        `json:"initialMode,omitempty"`
}

type UserSettings struct {
    Name        string                 `json:"name"`
    Email       string                 `json:"email"`
    Preferences map[string]interface{} `json:"preferences"`
}

type GitHubConfig struct {
    Repository string `json:"repository"`
    Branch     string `json:"branch,omitempty"`
    Token      string `json:"token"`
}

func NewCollaborationClient(baseURL, agentAuth string) *CollaborationClient {
    return &CollaborationClient{
        BaseURL:   baseURL,
        AgentAuth: agentAuth,
        Client: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

func (c *CollaborationClient) InitializeSession(config SessionConfig) (*SessionResponse, error) {
    jsonData, err := json.Marshal(config)
    if err != nil {
        return nil, err
    }

    req, err := http.NewRequest("POST", c.BaseURL+"/collaboration/session/initialize", bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }

    req.Header.Set("Content-Type", "application/json")
    if c.AgentAuth != "" {
        req.Header.Set("X-Agent-Auth", c.AgentAuth)
    }

    resp, err := c.Client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var sessionResp SessionResponse
    if err := json.NewDecoder(resp.Body).Decode(&sessionResp); err != nil {
        return nil, err
    }

    return &sessionResp, nil
}

func (c *CollaborationClient) IdeationChat(sessionID, message, aiMode string) (*ChatResponse, error) {
    payload := map[string]interface{}{
        "sessionId":    sessionID,
        "message":      message,
        "aiMode":       aiMode,
        "draftContent": "",
        "chatHistory":  []interface{}{},
    }

    jsonData, err := json.Marshal(payload)
    if err != nil {
        return nil, err
    }

    req, err := http.NewRequest("POST", c.BaseURL+"/collaboration/ideation/chat", bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }

    req.Header.Set("Content-Type", "application/json")
    if c.AgentAuth != "" {
        req.Header.Set("X-Agent-Auth", c.AgentAuth)
    }

    resp, err := c.Client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var chatResp ChatResponse
    if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
        return nil, err
    }

    return &chatResp, nil
}

func main() {
    client := NewCollaborationClient(
        "https://terragon-vercel.vercel.app/api",
        "your-agent-token",
    )

    session, err := client.InitializeSession(SessionConfig{
        UserSettings: UserSettings{
            Name:  "Go Developer",
            Email: "dev@example.com",
            Preferences: map[string]interface{}{
                "aiAssistanceLevel": "collaborative",
            },
        },
        GitHubConfig: GitHubConfig{
            Repository: "my-org/my-project",
            Token:      "github-token",
        },
    })
    if err != nil {
        panic(err)
    }

    fmt.Printf("Session initialized: %s\n", session.SessionID)

    response, err := client.IdeationChat(
        session.SessionID,
        "Help me create a Go-focused CLAUDE.md",
        "collaborative",
    )
    if err != nil {
        panic(err)
    }

    fmt.Printf("AI Response: %s\n", response.Response)
}
```

### cURL Examples

```bash
#!/bin/bash

# Set variables
BASE_URL="https://terragon-vercel.vercel.app/api"
AGENT_AUTH="your-agent-token"

# 1. Initialize collaboration session
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/collaboration/session/initialize" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Auth: $AGENT_AUTH" \
  -d '{
    "userSettings": {
      "name": "Shell Script User",
      "email": "dev@example.com",
      "preferences": {
        "aiAssistanceLevel": "collaborative",
        "autoSave": true
      }
    },
    "githubConfig": {
      "repository": "my-org/my-project",
      "branch": "main",
      "token": "'$GITHUB_TOKEN'"
    }
  }')

echo "Session Response: $SESSION_RESPONSE"

# Extract session ID
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId')
echo "Session ID: $SESSION_ID"

# 2. Start ideation chat
CHAT_RESPONSE=$(curl -s -X POST "$BASE_URL/collaboration/ideation/chat" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Auth: $AGENT_AUTH" \
  -d '{
    "sessionId": "'$SESSION_ID'",
    "message": "Help me create a comprehensive CLAUDE.md for a microservices architecture",
    "draftContent": "",
    "aiMode": "collaborative",
    "chatHistory": []
  }')

echo "Chat Response: $CHAT_RESPONSE"

# 3. Create a draft
DRAFT_RESPONSE=$(curl -s -X POST "$BASE_URL/collaboration/drafts/create" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Auth: $AGENT_AUTH" \
  -d '{
    "sessionId": "'$SESSION_ID'",
    "title": "Microservices CLAUDE.md",
    "content": "# Microservices Project\n\n## Overview\nThis project implements a microservices architecture...",
    "description": "Initial draft for microservices documentation"
  }')

echo "Draft Response: $DRAFT_RESPONSE"

# 4. Orchestrate tasks
ORCHESTRATION_RESPONSE=$(curl -s -X POST "$BASE_URL/collaboration/orchestration/decompose" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Auth: $AGENT_AUTH" \
  -d '{
    "sessionId": "'$SESSION_ID'",
    "taskDescription": "Implement comprehensive microservices documentation",
    "context": "Project uses Docker, Kubernetes, and event-driven architecture",
    "requirements": {
      "targetDuration": "10 minutes",
      "maxSteps": 12,
      "includeValidation": true
    }
  }')

echo "Orchestration Response: $ORCHESTRATION_RESPONSE"

# 5. Check security status
SECURITY_STATUS=$(curl -s -X GET "$BASE_URL/security/status")
echo "Security Status: $SECURITY_STATUS"
```

## Error Handling

### Comprehensive Error Handling

```javascript
class CollaborationErrorHandler {
  constructor(client) {
    this.client = client;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000
    };
  }

  async withRetry(operation, ...args) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation.apply(this.client, args);
      } catch (error) {
        lastError = error;
        
        if (!this.shouldRetry(error, attempt)) {
          throw error;
        }

        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelay
        );

        console.log(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  shouldRetry(error, attempt) {
    // Don't retry on authentication errors
    if (error.status === 401 || error.status === 403) {
      return false;
    }

    // Don't retry on validation errors
    if (error.status === 400) {
      return false;
    }

    // Don't retry on the last attempt
    if (attempt >= this.retryConfig.maxRetries) {
      return false;
    }

    // Retry on server errors and network issues
    return error.status >= 500 || error.code === 'NETWORK_ERROR';
  }

  async handleError(error, context = {}) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      error: error.message,
      status: error.status,
      context
    };

    switch (error.status) {
      case 400:
        console.error('❌ Bad Request:', error.message);
        throw new ValidationError(error.message, error.details);

      case 401:
        console.error('🔒 Unauthorized:', error.message);
        // Attempt token refresh
        await this.refreshToken();
        throw new AuthenticationError('Authentication failed - token refreshed');

      case 404:
        console.error('🔍 Not Found:', error.message);
        throw new ResourceNotFoundError(error.message);

      case 409:
        console.error('⚡ Conflict:', error.message);
        throw new ConflictError(error.message, error.details);

      case 429:
        console.error('🚦 Rate Limited:', error.message);
        const retryAfter = error.retryAfter || 60;
        await this.sleep(retryAfter * 1000);
        throw new RateLimitError(`Rate limited, retry after ${retryAfter}s`);

      case 500:
      case 502:
      case 503:
      case 504:
        console.error('🔥 Server Error:', error.message);
        // Log for monitoring
        await this.logServerError(errorInfo);
        throw new ServerError(error.message);

      default:
        console.error('❓ Unexpected Error:', error.message);
        throw new UnexpectedError(error.message);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async refreshToken() {
    // Implementation for token refresh
    try {
      const newToken = await this.client.security.refreshAgentToken();
      this.client.config.agentAuth = newToken.token;
    } catch (refreshError) {
      console.error('🔄 Token refresh failed:', refreshError);
    }
  }

  async logServerError(errorInfo) {
    // Send error info to monitoring service
    try {
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorInfo)
      });
    } catch (logError) {
      console.error('📊 Error logging failed:', logError);
    }
  }
}

// Custom error classes
class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class ResourceNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResourceNotFoundError';
  }
}

class ConflictError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ConflictError';
    this.details = details;
  }
}

class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}

class ServerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ServerError';
  }
}

class UnexpectedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnexpectedError';
  }
}

// Usage example
const errorHandler = new CollaborationErrorHandler(client);

try {
  const session = await errorHandler.withRetry(
    client.initializeSession,
    sessionConfig
  );
} catch (error) {
  await errorHandler.handleError(error, { operation: 'initializeSession' });
}
```

## Best Practices

### 1. Performance Optimization

```javascript
// Connection pooling and caching
class OptimizedCollaborationClient {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
    this.connectionPool = new ConnectionPool(config);
  }

  // Cache session data to reduce API calls
  async getCachedSession(sessionId) {
    const cacheKey = `session:${sessionId}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
        return cached.data;
      }
    }

    const session = await this.getSession(sessionId);
    this.cache.set(cacheKey, {
      data: session,
      timestamp: Date.now()
    });

    return session;
  }

  // Batch operations to reduce API calls
  async batchOperations(operations) {
    const results = await Promise.allSettled(
      operations.map(op => this.executeOperation(op))
    );

    return results.map((result, index) => ({
      operation: operations[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));
  }

  // Preload commonly used data
  async preloadSession(sessionId) {
    const preloadTasks = [
      this.getCachedSession(sessionId),
      this.getDrafts(sessionId),
      this.getWorkflowProgress(sessionId)
    ];

    await Promise.all(preloadTasks);
  }
}
```

### 2. Security Best Practices

```javascript
// Secure client configuration
class SecureCollaborationClient {
  constructor(config) {
    this.validateConfig(config);
    this.config = this.sanitizeConfig(config);
    this.setupSecurityMiddleware();
  }

  validateConfig(config) {
    if (!config.baseUrl || !config.baseUrl.startsWith('https://')) {
      throw new Error('Base URL must use HTTPS');
    }

    if (config.agentAuth && !this.isValidJWT(config.agentAuth)) {
      throw new Error('Invalid agent authentication token format');
    }
  }

  sanitizeConfig(config) {
    return {
      ...config,
      // Never log sensitive data
      agentAuth: config.agentAuth ? '[REDACTED]' : undefined,
      githubToken: config.githubToken ? '[REDACTED]' : undefined
    };
  }

  setupSecurityMiddleware() {
    // Add request/response interceptors for security
    this.requestInterceptors = [
      this.addSecurityHeaders.bind(this),
      this.validateRequest.bind(this),
      this.logSecurityEvents.bind(this)
    ];

    this.responseInterceptors = [
      this.validateResponse.bind(this),
      this.detectSecurityIssues.bind(this)
    ];
  }

  addSecurityHeaders(request) {
    request.headers = {
      ...request.headers,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    };
    return request;
  }

  async logSecurityEvents(request) {
    // Log security-relevant events
    const event = {
      timestamp: new Date().toISOString(),
      endpoint: request.url,
      method: request.method,
      hasAuth: !!request.headers['X-Agent-Auth'],
      userAgent: request.headers['User-Agent']
    };

    // Send to security monitoring
    await this.securityLogger.log(event);
  }
}
```

### 3. Monitoring and Observability

```javascript
// Comprehensive monitoring
class MonitoredCollaborationClient {
  constructor(config) {
    this.client = new CollaborationClient(config);
    this.metrics = new MetricsCollector();
    this.tracer = new RequestTracer();
  }

  async makeRequest(method, endpoint, data) {
    const traceId = this.tracer.startTrace();
    const startTime = Date.now();

    try {
      const result = await this.client[method](endpoint, data);
      
      // Record success metrics
      this.metrics.recordRequest({
        endpoint,
        method,
        duration: Date.now() - startTime,
        status: 'success',
        traceId
      });

      return result;
    } catch (error) {
      // Record error metrics
      this.metrics.recordRequest({
        endpoint,
        method,
        duration: Date.now() - startTime,
        status: 'error',
        error: error.message,
        traceId
      });

      throw error;
    } finally {
      this.tracer.endTrace(traceId);
    }
  }

  // Health check for the collaboration system
  async healthCheck() {
    const checks = {
      api: false,
      authentication: false,
      websocket: false,
      security: false
    };

    try {
      // Test API connectivity
      await this.client.get('/health');
      checks.api = true;

      // Test authentication
      await this.client.security.validateToken();
      checks.authentication = true;

      // Test WebSocket connectivity
      await this.testWebSocketConnection();
      checks.websocket = true;

      // Test security endpoints
      await this.client.security.getStatus();
      checks.security = true;

    } catch (error) {
      console.error('Health check failed:', error);
    }

    return {
      status: Object.values(checks).every(check => check) ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString()
    };
  }
}
```

## SDK Integration

### Official SDK Installation

```bash
# Node.js/JavaScript
npm install @terragon/collaboration-sdk

# Python
pip install terragon-collaboration

# Go
go get github.com/terragon-ai/collaboration-go

# Rust
cargo add terragon-collaboration
```

### SDK Configuration

```javascript
// Configuration with environment variables
const client = new CollaborationClient({
  baseUrl: process.env.TERRAGON_API_URL || 'https://terragon-vercel.vercel.app/api',
  agentAuth: process.env.TERRAGON_AGENT_TOKEN,
  timeout: parseInt(process.env.TERRAGON_TIMEOUT || '30000'),
  retries: parseInt(process.env.TERRAGON_RETRIES || '3'),
  logLevel: process.env.TERRAGON_LOG_LEVEL || 'info'
});

// Configuration for different environments
const configs = {
  development: {
    baseUrl: 'http://localhost:3000/api',
    logLevel: 'debug',
    timeout: 60000
  },
  staging: {
    baseUrl: 'https://staging-terragon.vercel.app/api',
    logLevel: 'info',
    timeout: 30000
  },
  production: {
    baseUrl: 'https://terragon-vercel.vercel.app/api',
    logLevel: 'warn',
    timeout: 30000,
    retries: 5
  }
};

const client = new CollaborationClient(configs[process.env.NODE_ENV]);
```

This developer guide provides comprehensive examples and patterns for integrating with the Claude.md Collaboration System. Each example is production-ready and includes proper error handling, security considerations, and best practices.