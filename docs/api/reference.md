# Claude.md Collaboration System - API Reference

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [API Endpoints](#api-endpoints)
6. [Data Models](#data-models)
7. [WebSocket Events](#websocket-events)
8. [Code Examples](#code-examples)

## Overview

The Claude.md Collaboration System API provides comprehensive endpoints for AI-powered document collaboration with sacred document integrity protection. The API follows REST principles and supports real-time synchronization through WebSockets.

### Base URL
```
Production: https://terragon-vercel.vercel.app/api
Development: http://localhost:3000/api
```

### API Version
Current Version: `v1.0.0`

### Content Type
All API endpoints accept and return JSON data with `Content-Type: application/json`.

## Authentication

### Agent Authentication (Recommended)

For automated systems and server-to-server communication:

```http
POST /api/collaboration/session/initialize
X-Agent-Auth: Bearer eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Token Format:**
- **Algorithm**: EdDSA (Ed25519)
- **Expiration**: 24 hours (configurable)
- **Claims**: `agentId`, `permissions`, `iat`, `exp`, `jti`

### Session Authentication

For user-facing applications:

```http
POST /api/collaboration/ideation/chat
Content-Type: application/json

{
  "sessionId": "collab_1691234567890_abc123def",
  "message": "Help me improve this section"
}
```

## Error Handling

### Error Response Format

All errors follow RFC 7807 Problem Details format:

```json
{
  "error": "error_type",
  "message": "Human-readable error message",
  "details": "Detailed error information",
  "timestamp": "2023-08-15T10:30:00Z",
  "traceId": "req_1691234567890_abc123"
}
```

### HTTP Status Codes

| Code | Description | Common Causes |
|------|-------------|---------------|
| `200` | Success | Request processed successfully |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid parameters, validation errors |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Resource state conflict, race condition |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error |

### Common Error Types

#### Authentication Errors
```json
{
  "error": "unauthorized",
  "message": "Invalid agent authentication token",
  "details": "The provided X-Agent-Auth token is invalid or expired"
}
```

#### Validation Errors
```json
{
  "error": "validation_failed",
  "message": "Required field 'sessionId' is missing",
  "details": "The sessionId parameter is required for all collaboration endpoints"
}
```

#### Sacred Principles Violations
```json
{
  "error": "sacred_principles_violation",
  "message": "Content violates sacred document principles",
  "violations": [
    {
      "principle": "NO_SIMULATIONS",
      "severity": "critical",
      "description": "Content contains simulation or mocking references"
    }
  ],
  "score": 0.3
}
```

## Rate Limiting

### Default Limits

| Endpoint Category | Requests/Minute | Burst Limit |
|-------------------|----------------|-------------|
| Standard endpoints | 100 | 20 |
| AI endpoints | 20 | 5 |
| WebSocket messages | 1000 | 100 |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2023-08-15T10:31:00Z
```

### Rate Limit Exceeded Response

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "retryAfter": 60
}
```

## API Endpoints

### Session Management

#### Initialize Collaboration Session

Creates a new collaboration session with authentication tokens and workflow state.

```http
POST /collaboration/session/initialize
```

**Request Body:**
```json
{
  "userSettings": {
    "name": "John Developer",
    "email": "john@example.com",
    "preferences": {
      "aiAssistanceLevel": "collaborative",
      "autoSave": true,
      "notificationChannels": ["email", "discord"]
    }
  },
  "githubConfig": {
    "repository": "my-org/my-project",
    "branch": "feature/claude-md-update",
    "token": "ghp_xxxxxxxxxxxx",
    "commitMessage": "Update CLAUDE.md via collaboration system"
  },
  "initialMode": "ideation"
}
```

**Response (`200 OK`):**
```json
{
  "sessionId": "collab_1691234567890_abc123def",
  "agentAuth": "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...",
  "sessionData": {
    "ideation": {
      "draftContent": "",
      "versionHistory": [],
      "chatHistory": []
    },
    "orchestration": {
      "taskDocument": "",
      "workflowSteps": []
    },
    "execution": {
      "checkpointDocument": "",
      "logs": []
    },
    "merge": {
      "originalContent": "",
      "conflicts": []
    }
  },
  "workflowProgress": {
    "ideation": "current",
    "orchestration": "available",
    "execution": "locked",
    "merge": "locked"
  },
  "status": "initialized"
}
```

**cURL Example:**
```bash
curl -X POST https://terragon-vercel.vercel.app/api/collaboration/session/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "userSettings": {
      "name": "John Developer",
      "email": "john@example.com",
      "preferences": {
        "aiAssistanceLevel": "collaborative",
        "autoSave": true
      }
    },
    "githubConfig": {
      "repository": "my-org/my-project",
      "token": "ghp_xxxxxxxxxxxx"
    }
  }'
```

---

### Ideation Phase

#### AI-Powered Ideation Chat

Engage with Claude AI for collaborative document ideation with multiple AI modes.

```http
POST /collaboration/ideation/chat
X-Agent-Auth: Bearer {token}
```

**Request Body:**
```json
{
  "sessionId": "collab_1691234567890_abc123def",
  "message": "Help me create a comprehensive API documentation section",
  "draftContent": "# My Project\n\n## Overview\nThis is my project...",
  "selectedText": "## API Documentation",
  "aiMode": "collaborative",
  "chatHistory": [
    {
      "role": "user",
      "content": "Previous question",
      "timestamp": "2023-08-15T10:25:00Z"
    },
    {
      "role": "assistant",
      "content": "Previous response",
      "timestamp": "2023-08-15T10:25:30Z"
    }
  ]
}
```

**AI Modes:**
- `collaborative`: Interactive brainstorming and content development
- `research`: Fact-based research and best practices
- `critique`: Analytical feedback and improvement suggestions

**Response (`200 OK`):**
```json
{
  "response": "For API documentation in CLAUDE.md, I recommend structuring it with clear sections for endpoints, authentication, examples, and error handling. Here's a comprehensive approach:\n\n## API Documentation\n\n### Authentication\n- Document all authentication methods\n- Provide example requests with auth headers\n- Include token refresh procedures\n\n### Endpoints\n- Group endpoints by functionality\n- Include request/response examples\n- Document all parameters and their types\n\n### Error Handling\n- List all possible HTTP status codes\n- Provide example error responses\n- Include troubleshooting guides",
  "suggestions": [
    "Add authentication examples",
    "Include error response formats",
    "Show curl examples",
    "Document rate limiting"
  ],
  "proposedChanges": [
    {
      "type": "suggestion",
      "description": "Add OpenAPI specification",
      "confidence": 0.8,
      "targetLocation": {
        "line": 15,
        "section": "## API Documentation"
      },
      "suggestedContent": "Consider adding an OpenAPI 3.0 specification file alongside the documentation."
    }
  ],
  "timestamp": "2023-08-15T10:30:00Z"
}
```

**JavaScript Example:**
```javascript
const response = await fetch('/api/collaboration/ideation/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-Auth': 'Bearer ' + agentToken
  },
  body: JSON.stringify({
    sessionId: 'collab_1691234567890_abc123def',
    message: 'Help me improve the error handling section',
    draftContent: currentDraft,
    aiMode: 'critique'
  })
});

const data = await response.json();
console.log('AI Response:', data.response);
console.log('Suggestions:', data.suggestions);
```

---

### Draft Management

#### Create New Draft

Creates a new draft with atomic checkpoint creation and sacred document validation.

```http
POST /collaboration/drafts/create
X-Agent-Auth: Bearer {token}
```

**Request Body:**
```json
{
  "sessionId": "collab_1691234567890_abc123def",
  "title": "API Documentation CLAUDE.md",
  "description": "Comprehensive API documentation for the project",
  "content": "# Project CLAUDE.md\n\n## 1. Project Overview\n- **Vision:** Create comprehensive API documentation\n- **Current Phase:** Documentation development\n- **Key Architecture:** RESTful API with OpenAPI specification\n\n## 2. Sacred Principles & AI Instructions\n\n### ABSOLUTE RULES - NEVER VIOLATE\n1. **NO SIMULATIONS** - Never simulate, mock, or fake any functionality\n2. **NO FALLBACKS** - Get to the root of problems, never create workarounds\n3. **NO TEMPLATES** - API documentation must be 100% custom and accurate\n4. **NO ASSUMPTIONS** - Always validate API behavior with actual testing\n5. **ALWAYS REAL** - Every endpoint, example, and response must be genuine\n\n## 3. API Documentation Standards\n\n### Endpoint Documentation\n- Complete request/response examples\n- All parameters documented with types and constraints\n- Error scenarios with actual response codes\n- Authentication requirements clearly stated\n\n### Code Examples\n- Working code examples in multiple languages\n- Real API responses, never fabricated\n- Include error handling patterns\n- Show best practices for integration\n\n## 4. Quality Requirements\n\n### Documentation Validation\n- All examples must be tested against live API\n- Response schemas validated with actual data\n- Error responses captured from real scenarios\n- Performance characteristics documented from testing\n\n### Maintenance\n- Documentation updated with every API change\n- Automated testing of all code examples\n- Version compatibility clearly indicated\n- Deprecation notices with migration paths",
  "metadata": {
    "tags": ["api", "documentation", "sacred"],
    "author": "API Documentation Team",
    "version": "1.0.0",
    "project": "collaboration-api"
  }
}
```

**Response (`201 Created`):**
```json
{
  "draftId": "draft_1691234567890_xyz789",
  "sessionId": "collab_1691234567890_abc123def",
  "title": "API Documentation CLAUDE.md",
  "version": 1,
  "checkpointId": "checkpoint_abc123",
  "timestamp": "2023-08-15T10:30:00Z",
  "stats": {
    "wordCount": 245,
    "characterCount": 1520,
    "lineCount": 42
  },
  "validation": {
    "isValid": true,
    "score": 0.95,
    "errors": [],
    "warnings": [],
    "suggestions": ["Consider adding more specific examples"]
  },
  "status": "created"
}
```

**Python Example:**
```python
import requests

response = requests.post(
    'https://terragon-vercel.vercel.app/api/collaboration/drafts/create',
    headers={
        'Content-Type': 'application/json',
        'X-Agent-Auth': f'Bearer {agent_token}'
    },
    json={
        'sessionId': session_id,
        'title': 'API Documentation Draft',
        'content': draft_content,
        'description': 'Initial API documentation draft'
    }
)

if response.status_code == 201:
    draft = response.json()
    print(f"Draft created: {draft['draftId']}")
    print(f"Validation score: {draft['validation']['score']}")
else:
    print(f"Error: {response.json()}")
```

#### Retrieve Draft

Retrieves a specific draft with full version history and metadata.

```http
GET /collaboration/drafts/{draftId}
```

**Response (`200 OK`):**
```json
{
  "id": "draft_1691234567890_xyz789",
  "sessionId": "collab_1691234567890_abc123def",
  "title": "API Documentation CLAUDE.md",
  "description": "Comprehensive API documentation for the project",
  "content": "# Project CLAUDE.md\n\n## 1. Project Overview...",
  "metadata": {
    "tags": ["api", "documentation", "sacred"],
    "author": "API Documentation Team",
    "version": "1.0.0",
    "wordCount": 245,
    "characterCount": 1520,
    "lineCount": 42,
    "contentHash": "sha256:abc123def456..."
  },
  "version": 1,
  "versionHistory": [
    {
      "version": 1,
      "timestamp": "2023-08-15T10:30:00Z",
      "content": "# Project CLAUDE.md...",
      "changes": {
        "added": 42,
        "removed": 0,
        "modified": 0,
        "total": 42
      },
      "checkpointId": "checkpoint_abc123"
    }
  ],
  "status": "draft",
  "createdAt": "2023-08-15T10:30:00Z",
  "lastModified": "2023-08-15T10:30:00Z",
  "checkpointId": "checkpoint_abc123"
}
```

#### Update Draft

Updates an existing draft with version tracking and atomic checkpoints.

```http
PUT /collaboration/drafts/{draftId}
X-Agent-Auth: Bearer {token}
```

**Request Body:**
```json
{
  "content": "# Project CLAUDE.md\n\n## 1. Project Overview\n- **Vision:** Create comprehensive API documentation\n- **Current Phase:** Documentation development with examples\n- **Key Architecture:** RESTful API with OpenAPI specification and SDK support\n\n## 2. Sacred Principles & AI Instructions\n\n### ABSOLUTE RULES - NEVER VIOLATE\n1. **NO SIMULATIONS** - Never simulate, mock, or fake any functionality\n2. **NO FALLBACKS** - Get to the root of problems, never create workarounds\n3. **NO TEMPLATES** - API documentation must be 100% custom and accurate\n4. **NO ASSUMPTIONS** - Always validate API behavior with actual testing\n5. **ALWAYS REAL** - Every endpoint, example, and response must be genuine\n\n## 3. API Documentation Standards\n\n### Endpoint Documentation\n- Complete request/response examples with real data\n- All parameters documented with types, constraints, and validation rules\n- Error scenarios with actual response codes and troubleshooting\n- Authentication requirements with working examples\n- Rate limiting details with actual limits and headers\n\n### Code Examples\n- Working code examples in JavaScript, Python, Go, and cURL\n- Real API responses captured from live testing\n- Error handling patterns with actual error scenarios\n- SDK integration examples with installation instructions\n- Authentication flows with step-by-step implementation\n\n### Interactive Documentation\n- OpenAPI 3.0 specification with try-it-out functionality\n- Postman collection with all endpoints and examples\n- Interactive examples that developers can run immediately\n- Live API explorer with authentication sandbox\n\n## 4. Quality Requirements\n\n### Documentation Validation\n- All examples tested against live API in CI/CD pipeline\n- Response schemas validated with JSON Schema\n- Error responses captured from comprehensive testing\n- Performance characteristics documented from load testing\n- Security examples validated by security team\n\n### Developer Experience\n- Documentation searchable and well-organized\n- Quick start guide with working example in under 5 minutes\n- Troubleshooting section with common issues and solutions\n- Community feedback integration with regular updates\n- Multi-language support for international developers\n\n### Maintenance\n- Documentation updated automatically with API changes\n- Automated testing of all code examples in multiple environments\n- Version compatibility matrix with upgrade guides\n- Deprecation notices with 6-month migration timeline\n- Regular developer surveys and usability testing",
  "title": "API Documentation CLAUDE.md v1.1",
  "description": "Enhanced with interactive examples and developer experience improvements",
  "changeDescription": "Added interactive documentation section, enhanced code examples with multiple languages, improved developer experience requirements",
  "metadata": {
    "tags": ["api", "documentation", "sacred", "interactive"],
    "author": "API Documentation Team",
    "version": "1.1.0",
    "project": "collaboration-api"
  }
}
```

**Response (`200 OK`):**
```json
{
  "draftId": "draft_1691234567890_xyz789",
  "version": 2,
  "checkpointId": "checkpoint_def456",
  "changes": {
    "added": 15,
    "removed": 2,
    "modified": 8,
    "total": 25
  },
  "validation": {
    "isValid": true,
    "score": 0.97,
    "errors": [],
    "warnings": [],
    "suggestions": ["Excellent improvements to developer experience"]
  },
  "timestamp": "2023-08-15T10:45:00Z"
}
```

#### List Drafts

Lists all drafts for a session with pagination support.

```http
GET /collaboration/drafts/list?sessionId={sessionId}&limit=10&offset=0&status=draft
```

**Query Parameters:**
- `sessionId` (required): Session identifier
- `limit` (optional): Number of drafts to return (default: 10, max: 100)
- `offset` (optional): Number of drafts to skip (default: 0)
- `status` (optional): Filter by status (`draft`, `published`, `archived`)
- `tags` (optional): Filter by tags (comma-separated)

**Response (`200 OK`):**
```json
{
  "drafts": [
    {
      "id": "draft_1691234567890_xyz789",
      "title": "API Documentation CLAUDE.md v1.1",
      "description": "Enhanced with interactive examples",
      "version": 2,
      "status": "draft",
      "createdAt": "2023-08-15T10:30:00Z",
      "lastModified": "2023-08-15T10:45:00Z",
      "stats": {
        "wordCount": 312,
        "characterCount": 2140,
        "lineCount": 58
      },
      "metadata": {
        "tags": ["api", "documentation", "sacred", "interactive"],
        "author": "API Documentation Team"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### Orchestration Phase

#### Decompose Task

Uses Claude AI to decompose complex tasks into manageable micro-tasks.

```http
POST /collaboration/orchestration/decompose
X-Agent-Auth: Bearer {token}
```

**Request Body:**
```json
{
  "sessionId": "collab_1691234567890_abc123def",
  "taskDescription": "Create comprehensive API documentation with interactive examples, multi-language code samples, and automated testing integration",
  "context": "Building developer-focused documentation for a REST API collaboration system. Must follow sacred principles: no simulations, no fallbacks, no templates, real implementations only.",
  "requirements": {
    "targetDuration": "10 minutes",
    "maxSteps": 12,
    "includeValidation": true,
    "generateDependencies": true
  }
}
```

**Response (`200 OK`):**
```json
{
  "steps": [
    {
      "id": "step_001",
      "title": "Create OpenAPI 3.0 specification",
      "description": "Generate comprehensive OpenAPI specification with all endpoints, request/response schemas, and authentication details. Include real examples from API testing.",
      "estimatedDuration": "8 minutes",
      "assignedAgent": "api-documenter",
      "dependencies": [],
      "deliverables": [
        "Complete OpenAPI 3.0 YAML file",
        "Validated schema with real API responses",
        "Authentication examples with working tokens"
      ],
      "validationCriteria": [
        "OpenAPI spec validates without errors",
        "All endpoints documented with examples",
        "Authentication flows properly documented"
      ],
      "priority": "high"
    },
    {
      "id": "step_002",
      "title": "Generate multi-language code examples",
      "description": "Create working code examples in JavaScript, Python, Go, and cURL. All examples must be tested against live API endpoints.",
      "estimatedDuration": "10 minutes",
      "assignedAgent": "code-example-generator",
      "dependencies": ["step_001"],
      "deliverables": [
        "JavaScript SDK examples with error handling",
        "Python requests examples with authentication",
        "Go HTTP client examples with proper types",
        "cURL examples with all required headers"
      ],
      "validationCriteria": [
        "All code examples execute successfully",
        "Error handling demonstrated in each language",
        "Authentication properly implemented"
      ],
      "priority": "high"
    },
    {
      "id": "step_003",
      "title": "Create interactive documentation portal",
      "description": "Build interactive documentation with try-it-out functionality. Integrate OpenAPI spec with documentation generator.",
      "estimatedDuration": "10 minutes",
      "assignedAgent": "frontend-developer",
      "dependencies": ["step_001", "step_002"],
      "deliverables": [
        "Interactive API explorer",
        "Try-it-out functionality for all endpoints",
        "Real-time response display",
        "Authentication sandbox"
      ],
      "validationCriteria": [
        "All endpoints callable from documentation",
        "Authentication flow works in sandbox",
        "Responses display correctly"
      ],
      "priority": "medium"
    },
    {
      "id": "step_004",
      "title": "Implement automated testing for examples",
      "description": "Create automated tests that validate all code examples work correctly. Include CI/CD integration to test on every API change.",
      "estimatedDuration": "9 minutes",
      "assignedAgent": "test-automator",
      "dependencies": ["step_002"],
      "deliverables": [
        "Test suite for all code examples",
        "CI/CD pipeline integration",
        "Automated validation of documentation accuracy",
        "Error reporting for broken examples"
      ],
      "validationCriteria": [
        "All tests pass on first run",
        "CI pipeline successfully validates examples",
        "Failed tests provide actionable error messages"
      ],
      "priority": "high"
    }
  ],
  "dependencies": [
    ["step_002", ["step_001"]],
    ["step_003", ["step_001", "step_002"]],
    ["step_004", ["step_002"]]
  ],
  "timeEstimates": {
    "step_001": 480000,
    "step_002": 600000,
    "step_003": 600000,
    "step_004": 540000
  },
  "recommendedAgents": [
    "api-documenter",
    "code-example-generator", 
    "frontend-developer",
    "test-automator"
  ],
  "metadata": {
    "totalSteps": 4,
    "estimatedTotalTime": 2220000,
    "generatedAt": "2023-08-15T10:30:00Z",
    "taskDescription": "Create comprehensive API documentation with interactive examples, multi-language code samples, and automated testing integration",
    "complexity": "medium"
  }
}
```

**Go Example:**
```go
type DecomposeRequest struct {
    SessionID       string                 `json:"sessionId"`
    TaskDescription string                 `json:"taskDescription"`
    Context         string                 `json:"context"`
    Requirements    map[string]interface{} `json:"requirements"`
}

func decomposeTask(client *http.Client, req DecomposeRequest) (*DecomposeResponse, error) {
    jsonData, err := json.Marshal(req)
    if err != nil {
        return nil, err
    }

    httpReq, err := http.NewRequest("POST", baseURL+"/collaboration/orchestration/decompose", bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }

    httpReq.Header.Set("Content-Type", "application/json")
    httpReq.Header.Set("X-Agent-Auth", "Bearer "+agentToken)

    resp, err := client.Do(httpReq)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var decomposeResp DecomposeResponse
    if err := json.NewDecoder(resp.Body).Decode(&decomposeResp); err != nil {
        return nil, err
    }

    return &decomposeResp, nil
}
```

---

### Execution Phase

#### Create Checkpoint

Creates an atomic checkpoint for task execution with cryptographic integrity.

```http
POST /collaboration/checkpoints/create
X-Agent-Auth: Bearer {token}
```

**Request Body:**
```json
{
  "sessionId": "collab_1691234567890_abc123def",
  "stepId": "step_001",
  "metadata": {
    "agent": "api-documenter",
    "tools": ["openapi-generator", "yaml-validator", "schema-tester"],
    "description": "Create OpenAPI 3.0 specification with real examples",
    "priority": "high",
    "estimatedDuration": "8 minutes"
  },
  "expectedDuration": 480000,
  "dependencies": []
}
```

**Response (`201 Created`):**
```json
{
  "checkpointId": "checkpoint_1691234567890_abc123",
  "sessionId": "collab_1691234567890_abc123def",
  "stepId": "step_001",
  "status": "created",
  "integrityHash": "sha3:abc123def456|blake3:def456abc123",
  "timestamp": "2023-08-15T10:30:00Z",
  "expiresAt": "2023-08-15T10:40:00Z",
  "metadata": {
    "lockKey": "checkpoint:collab_1691234567890_abc123def:step_001",
    "created": "2023-08-15T10:30:00Z"
  }
}
```

#### Execute Checkpoint

Executes a checkpoint with real-time monitoring and progress updates.

```http
POST /collaboration/checkpoints/{checkpointId}/execute
X-Agent-Auth: Bearer {token}
```

**Request Body:**
```json
{
  "executionParams": {
    "targetFiles": ["docs/api/openapi.yaml", "docs/api/examples/"],
    "templateData": {
      "apiVersion": "1.0.0",
      "baseUrl": "https://terragon-vercel.vercel.app/api",
      "authType": "bearer"
    },
    "validationRules": {
      "requireExamples": true,
      "validateSchemas": true,
      "testEndpoints": true
    }
  },
  "monitoringConfig": {
    "realTimeUpdates": true,
    "progressCallback": "https://example.com/api/progress",
    "maxExecutionTime": 600000
  }
}
```

**Response (`200 OK`):**
```json
{
  "executionId": "exec_1691234567890_xyz789",
  "checkpointId": "checkpoint_1691234567890_abc123",
  "status": "executing",
  "progress": {
    "currentStep": "Generating OpenAPI specification",
    "completionPercentage": 0,
    "estimatedTimeRemaining": 480000
  },
  "streamUrl": "wss://terragon-vercel.vercel.app/api/collaboration/sync/websocket?executionId=exec_1691234567890_xyz789",
  "monitoringUrl": "/api/collaboration/checkpoints/checkpoint_1691234567890_abc123/monitor"
}
```

#### Monitor Checkpoint Execution

Monitor the progress of checkpoint execution with real-time updates.

```http
GET /collaboration/checkpoints/{checkpointId}/monitor
```

**Response (`200 OK`):**
```json
{
  "checkpointId": "checkpoint_1691234567890_abc123",
  "executionId": "exec_1691234567890_xyz789",
  "status": "executing",
  "progress": {
    "currentStep": "Validating OpenAPI schemas",
    "completionPercentage": 65,
    "estimatedTimeRemaining": 168000,
    "steps": [
      {
        "name": "Generate base OpenAPI structure",
        "status": "completed",
        "duration": 45000
      },
      {
        "name": "Add endpoint definitions",
        "status": "completed", 
        "duration": 120000
      },
      {
        "name": "Validate OpenAPI schemas",
        "status": "executing",
        "startTime": "2023-08-15T10:33:45Z"
      },
      {
        "name": "Test endpoint examples",
        "status": "pending"
      }
    ]
  },
  "logs": [
    {
      "timestamp": "2023-08-15T10:30:15Z",
      "level": "info",
      "message": "Starting OpenAPI generation",
      "metadata": {
        "agent": "api-documenter",
        "tool": "openapi-generator"
      }
    },
    {
      "timestamp": "2023-08-15T10:31:00Z",
      "level": "info", 
      "message": "Generated 15 endpoint definitions",
      "metadata": {
        "endpointCount": 15,
        "schemasCount": 8
      }
    },
    {
      "timestamp": "2023-08-15T10:33:45Z",
      "level": "info",
      "message": "Validating schemas against live API",
      "metadata": {
        "validationTool": "yaml-validator"
      }
    }
  ],
  "metrics": {
    "startTime": "2023-08-15T10:30:00Z",
    "elapsedTime": 225000,
    "memoryUsage": "45MB",
    "cpuUsage": "12%"
  }
}
```

---

### Merge Phase

#### Detect Merge Conflicts

Analyzes potential conflicts between original and modified content using semantic analysis.

```http
GET /collaboration/merge/conflicts?sessionId={sessionId}&originalHash={hash}&modifiedHash={hash}
```

**Query Parameters:**
- `sessionId` (required): Session identifier
- `originalHash` (required): Hash of original content
- `modifiedHash` (required): Hash of modified content

**Response (`200 OK`):**
```json
{
  "hasConflicts": true,
  "conflicts": [
    {
      "id": "conflict_001",
      "type": "content",
      "line": 42,
      "section": "## 3. API Documentation Standards",
      "originalContent": "### Endpoint Documentation\n- Complete request/response examples\n- All parameters documented with types",
      "modifiedContent": "### Endpoint Documentation\n- Complete request/response examples with real data\n- All parameters documented with types, constraints, and validation rules\n- Error scenarios with actual response codes",
      "severity": "medium",
      "resolution": "manual",
      "suggestions": [
        "Merge both versions to include comprehensive documentation",
        "Keep the enhanced version with real data and validation details"
      ]
    },
    {
      "id": "conflict_002", 
      "type": "structure",
      "line": 78,
      "section": "## 4. Quality Requirements",
      "originalContent": "### Documentation Validation\n- All examples tested against live API",
      "modifiedContent": "### Documentation Validation\n- All examples tested against live API in CI/CD pipeline\n- Response schemas validated with JSON Schema\n- Error responses captured from comprehensive testing",
      "severity": "low",
      "resolution": "automatic",
      "suggestions": [
        "Accept the enhanced version with additional validation steps"
      ]
    }
  ],
  "resolution": {
    "strategy": "ai_assisted",
    "confidence": 0.8,
    "recommendations": [
      "Use AI-assisted resolution for medium severity conflicts",
      "Automatically resolve low severity conflicts",
      "Manual review recommended for section structure changes"
    ]
  },
  "metadata": {
    "analysisTimestamp": "2023-08-15T10:35:00Z",
    "originalLines": 120,
    "modifiedLines": 145,
    "conflictLines": 12,
    "semanticSimilarity": 0.87
  }
}
```

#### Resolve Merge Conflicts

Resolves detected conflicts using AI assistance or manual resolution.

```http
POST /collaboration/merge/resolve
X-Agent-Auth: Bearer {token}
```

**Request Body:**
```json
{
  "sessionId": "collab_1691234567890_abc123def",
  "conflicts": [
    {
      "conflictId": "conflict_001",
      "resolution": "manual_merge",
      "customContent": "### Endpoint Documentation\n- Complete request/response examples with real data from live API testing\n- All parameters documented with types, constraints, validation rules, and default values\n- Error scenarios with actual response codes and troubleshooting guidance\n- Authentication requirements with working token examples\n- Rate limiting details with actual limits and headers"
    },
    {
      "conflictId": "conflict_002",
      "resolution": "accept_modified"
    }
  ],
  "resolutionStrategy": "balanced",
  "validateIntegrity": true
}
```

**Response (`200 OK`):**
```json
{
  "mergedContent": "# Project CLAUDE.md\n\n## 1. Project Overview\n- **Vision:** Create comprehensive API documentation\n- **Current Phase:** Documentation development with examples\n- **Key Architecture:** RESTful API with OpenAPI specification and SDK support\n\n## 2. Sacred Principles & AI Instructions\n\n### ABSOLUTE RULES - NEVER VIOLATE\n1. **NO SIMULATIONS** - Never simulate, mock, or fake any functionality\n2. **NO FALLBACKS** - Get to the root of problems, never create workarounds\n3. **NO TEMPLATES** - API documentation must be 100% custom and accurate\n4. **NO ASSUMPTIONS** - Always validate API behavior with actual testing\n5. **ALWAYS REAL** - Every endpoint, example, and response must be genuine\n\n## 3. API Documentation Standards\n\n### Endpoint Documentation\n- Complete request/response examples with real data from live API testing\n- All parameters documented with types, constraints, validation rules, and default values\n- Error scenarios with actual response codes and troubleshooting guidance\n- Authentication requirements with working token examples\n- Rate limiting details with actual limits and headers\n\n### Code Examples\n- Working code examples in JavaScript, Python, Go, and cURL\n- Real API responses captured from live testing\n- Error handling patterns with actual error scenarios\n- SDK integration examples with installation instructions\n\n## 4. Quality Requirements\n\n### Documentation Validation\n- All examples tested against live API in CI/CD pipeline\n- Response schemas validated with JSON Schema\n- Error responses captured from comprehensive testing\n- Performance characteristics documented from load testing\n\n### Maintenance\n- Documentation updated automatically with API changes\n- Automated testing of all code examples in multiple environments\n- Version compatibility matrix with upgrade guides\n- Deprecation notices with 6-month migration timeline",
  "resolutionSummary": {
    "totalConflicts": 2,
    "resolved": 2,
    "pending": 0,
    "strategy": "balanced",
    "resolutionMethods": {
      "manual_merge": 1,
      "accept_modified": 1,
      "accept_original": 0,
      "ai_suggestion": 0
    }
  },
  "integrityValidation": {
    "isValid": true,
    "score": 0.96,
    "errors": [],
    "warnings": [],
    "suggestions": ["Excellent merge resolution maintaining sacred principles"]
  },
  "checkpointId": "checkpoint_merge_final_abc123",
  "timestamp": "2023-08-15T10:40:00Z",
  "metadata": {
    "finalWordCount": 387,
    "finalCharacterCount": 2845,
    "finalLineCount": 67,
    "mergeQuality": "high"
  }
}
```

---

### Real-time Synchronization

#### Get Synchronization State

Retrieves current state of all active sessions and synchronization status.

```http
GET /collaboration/sync/state?sessionId={sessionId}
```

**Response (`200 OK`):**
```json
{
  "sessionId": "collab_1691234567890_abc123def",
  "lastSync": "2023-08-15T10:39:30Z",
  "activeUsers": [
    {
      "userId": "user_123",
      "name": "John Developer",
      "lastActivity": "2023-08-15T10:39:15Z",
      "currentPhase": "merge",
      "permissions": ["read", "write", "execute"]
    },
    {
      "userId": "user_456", 
      "name": "AI Assistant",
      "lastActivity": "2023-08-15T10:39:30Z",
      "currentPhase": "merge",
      "permissions": ["read", "write", "ai_assist"]
    }
  ],
  "currentPhase": "merge",
  "pendingUpdates": [
    {
      "updateId": "update_789",
      "type": "conflict_resolved",
      "timestamp": "2023-08-15T10:40:00Z",
      "data": {
        "conflictId": "conflict_001",
        "resolution": "manual_merge"
      },
      "priority": "medium"
    }
  ],
  "locks": {
    "merge_operation": {
      "lockedBy": "user_123",
      "lockedAt": "2023-08-15T10:39:45Z",
      "expiresAt": "2023-08-15T10:44:45Z"
    }
  },
  "phaseProgress": {
    "ideation": "completed",
    "orchestration": "completed", 
    "execution": "completed",
    "merge": "in_progress"
  }
}
```

---

### Security

#### Initialize Security System

Initializes Phase 2A security controls including agent authentication, dual-hash integrity verification, atomic checkpoints, and sacred document protection.

```http
POST /security/initialize
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Phase 2A security controls initialized successfully",
  "result": {
    "agentAuthentication": "initialized",
    "integrityVerification": "initialized", 
    "atomicCheckpoints": "initialized",
    "sacredDocumentProtection": "initialized"
  },
  "status": {
    "agentAuthentication": {
      "enabled": true,
      "algorithm": "EdDSA",
      "keyStrength": "Ed25519"
    },
    "integrityVerification": {
      "enabled": true,
      "primaryAlgorithm": "SHA3-256",
      "secondaryAlgorithm": "BLAKE3"
    },
    "atomicCheckpoints": {
      "enabled": true,
      "lockManager": "active",
      "maxCheckpoints": 100
    },
    "sacredDocumentProtection": {
      "enabled": true,
      "monitoringActive": true,
      "violationCount": 0
    }
  },
  "components": {
    "agentAuthentication": "RSA-2048/Ed25519 certificates",
    "integrityVerification": "SHA3-256 + BLAKE3 dual hashing",
    "atomicCheckpoints": "Race condition prevention",
    "sacredDocumentProtection": "CLAUDE.md protection middleware"
  },
  "timestamp": "2023-08-15T10:30:00Z"
}
```

#### Get Security Status

Returns current status of all security components and recent events.

```http
GET /security/status
```

**Response (`200 OK`):**
```json
{
  "overallStatus": "secure",
  "lastUpdated": "2023-08-15T10:40:00Z",
  "components": {
    "agentAuthentication": {
      "enabled": true,
      "activeTokens": 15,
      "lastRotation": "2023-08-15T09:30:00Z",
      "expiredTokens": 3,
      "revokedTokens": 0
    },
    "integrityVerification": {
      "enabled": true,
      "algorithm": "SHA3-256+BLAKE3",
      "lastVerification": "2023-08-15T10:39:45Z",
      "verificationsToday": 127,
      "failedVerifications": 0
    },
    "atomicCheckpoints": {
      "enabled": true,
      "activeCheckpoints": 5,
      "lastCleanup": "2023-08-15T10:30:00Z",
      "expiredCheckpoints": 0,
      "lockConflicts": 0
    },
    "sacredDocumentProtection": {
      "enabled": true,
      "lastIntegrityCheck": "2023-08-15T10:39:30Z",
      "violationCount": 0,
      "documentsMonitored": 3,
      "principleViolations": 0
    }
  },
  "recentEvents": [
    {
      "timestamp": "2023-08-15T10:39:45Z",
      "type": "integrity_check",
      "status": "success",
      "component": "sacredDocumentProtection"
    },
    {
      "timestamp": "2023-08-15T10:35:12Z",
      "type": "checkpoint_created",
      "status": "success", 
      "component": "atomicCheckpoints"
    },
    {
      "timestamp": "2023-08-15T10:30:00Z",
      "type": "token_rotation",
      "status": "success",
      "component": "agentAuthentication"
    }
  ],
  "metrics": {
    "averageResponseTime": "45ms",
    "securityScore": 0.98,
    "uptime": "99.9%",
    "threatsBlocked": 0
  }
}
```

#### Verify Sacred Document

Verifies CLAUDE.md integrity using cryptographic hashing and sacred principles validation.

```http
POST /security/verify-sacred
```

**Request Body:**
```json
{
  "content": "# Test Project CLAUDE.md\n\n## Sacred Principles\n\n### ABSOLUTE RULES - NEVER VIOLATE\n1. **NO SIMULATIONS** - Never simulate, mock, or fake any functionality\n2. **NO FALLBACKS** - Get to the root of problems, never create workarounds\n3. **NO TEMPLATES** - Task decomposition must be 100% AI-driven and dynamic\n4. **NO ASSUMPTIONS** - Always check CLAUDE.md before asking questions\n5. **ALWAYS REAL** - Every interaction, API call, and execution must be genuine\n\n## Development Guidelines\n- Document-driven development approach\n- Quality is #1 priority\n- Real implementations only\n- Comprehensive testing required",
  "expectedHash": "sha3:abc123def456|blake3:def456abc123",
  "strictMode": true
}
```

**Response (`200 OK`):**
```json
{
  "isValid": true,
  "integrityCheck": {
    "hashMatch": true,
    "expectedHash": "sha3:abc123def456|blake3:def456abc123",
    "actualHash": "sha3:abc123def456|blake3:def456abc123",
    "algorithms": ["SHA3-256", "BLAKE3"]
  },
  "sacredPrinciplesCheck": {
    "compliant": true,
    "violations": [],
    "warnings": [],
    "score": 0.98,
    "principlesValidated": [
      "NO_SIMULATIONS",
      "NO_FALLBACKS", 
      "NO_TEMPLATES",
      "NO_ASSUMPTIONS",
      "ALWAYS_REAL"
    ]
  },
  "recommendations": [
    "Document maintains excellent compliance with sacred principles",
    "Consider adding more specific implementation guidelines"
  ],
  "timestamp": "2023-08-15T10:40:00Z",
  "metadata": {
    "contentLength": 612,
    "lineCount": 17,
    "wordCount": 85,
    "validationDuration": "23ms"
  }
}
```

---

### Meta-Agent Integration

#### Integrate with Meta-Agent System

Seamlessly integrates collaboration workflow with Meta-Agent and Terragon AI for actual task execution.

```http
POST /collaboration/meta-agent/integrate
X-Agent-Auth: Bearer {token}
```

**Request Body:**
```json
{
  "sessionId": "collab_1691234567890_abc123def",
  "taskDocument": "# Task: Create Comprehensive API Documentation\n\n## Objective\nCreate developer-focused API documentation with interactive examples, multi-language code samples, and automated testing integration.\n\n## Sacred Principles Compliance\n- NO SIMULATIONS: All examples must be tested against live API\n- NO FALLBACKS: If documentation fails, fix the root cause\n- NO TEMPLATES: Documentation must be custom and accurate\n- NO ASSUMPTIONS: Validate all API behavior through testing\n- ALWAYS REAL: Every endpoint and example must be genuine\n\n## Detailed Steps\n\n### Step 1: Create OpenAPI 3.0 Specification\n**Agent**: api-documenter\n**Duration**: 8 minutes\n**Deliverables**:\n- Complete OpenAPI YAML file with all endpoints\n- Real request/response examples from API testing\n- Authentication flow documentation\n- Error response schemas\n\n### Step 2: Generate Multi-Language Code Examples\n**Agent**: code-example-generator\n**Duration**: 10 minutes\n**Dependencies**: Step 1\n**Deliverables**:\n- JavaScript SDK examples with error handling\n- Python requests examples with authentication\n- Go HTTP client examples with proper types\n- cURL examples with all required headers\n\n### Step 3: Create Interactive Documentation Portal\n**Agent**: frontend-developer\n**Duration**: 10 minutes\n**Dependencies**: Steps 1, 2\n**Deliverables**:\n- Interactive API explorer with try-it-out functionality\n- Real-time response display\n- Authentication sandbox\n- Integrated code examples\n\n### Step 4: Implement Automated Testing\n**Agent**: test-automator\n**Duration**: 9 minutes\n**Dependencies**: Step 2\n**Deliverables**:\n- Automated test suite for all code examples\n- CI/CD pipeline integration\n- Documentation accuracy validation\n- Error reporting for broken examples\n\n## Success Criteria\n- All code examples execute successfully against live API\n- Interactive documentation allows real API calls\n- Automated tests validate documentation accuracy\n- Zero tolerance for mock or simulated content\n- Comprehensive error handling demonstrated",
  "executionConfig": {
    "autonomousMode": true,
    "progressNotifications": true,
    "discordIntegration": true,
    "approvalRequired": true,
    "qualityGates": {
      "requireTestValidation": true,
      "requireSecurityReview": false,
      "requirePerformanceBaseline": false
    }
  }
}
```

**Response (`200 OK`):**
```json
{
  "integrationId": "integration_1691234567890_abc123",
  "metaAgentTaskId": "meta_task_api_docs_xyz789",
  "terragonSessionId": "terragon_session_def456",
  "monitoringUrl": "https://terragon-vercel.vercel.app/api/task-monitor/stream/meta_task_api_docs_xyz789",
  "discordChannelId": "1234567890123456789",
  "status": "pending_approval",
  "workflow": {
    "totalSteps": 4,
    "estimatedDuration": 2220000,
    "currentStep": null,
    "approvalRequired": true
  },
  "notifications": {
    "discord": {
      "enabled": true,
      "channelId": "1234567890123456789",
      "mentionRoles": ["@developers", "@api-team"]
    },
    "webhook": {
      "enabled": true,
      "url": "https://example.com/api/progress",
      "events": ["step_completed", "approval_required", "task_completed"]
    }
  },
  "qualityControls": {
    "testValidation": "required",
    "securityReview": "skipped",
    "performanceBaseline": "skipped",
    "sacredPrinciplesCheck": "required"
  }
}
```

#### Get Meta-Agent Status

Returns current status of Meta-Agent integration and task execution progress.

```http
GET /collaboration/meta-agent/status?sessionId={sessionId}
```

**Response (`200 OK`):**
```json
{
  "sessionId": "collab_1691234567890_abc123def",
  "integrationId": "integration_1691234567890_abc123",
  "metaAgentTaskId": "meta_task_api_docs_xyz789",
  "status": "executing",
  "currentStep": {
    "stepId": "step_002",
    "title": "Generate Multi-Language Code Examples",
    "status": "executing",
    "progress": 45,
    "startTime": "2023-08-15T10:42:00Z",
    "estimatedCompletion": "2023-08-15T10:50:00Z"
  },
  "overallProgress": {
    "completedSteps": 1,
    "totalSteps": 4,
    "percentage": 25,
    "elapsedTime": 720000,
    "estimatedTimeRemaining": 1500000
  },
  "stepResults": [
    {
      "stepId": "step_001",
      "title": "Create OpenAPI 3.0 Specification",
      "status": "completed",
      "completedAt": "2023-08-15T10:42:00Z",
      "duration": 480000,
      "deliverables": [
        {
          "name": "OpenAPI YAML file",
          "path": "docs/api/openapi.yaml",
          "size": "15.2KB",
          "validated": true
        },
        {
          "name": "Authentication examples",
          "path": "docs/api/auth-examples.md",
          "size": "3.1KB",
          "validated": true
        }
      ],
      "validationResults": {
        "openApiValid": true,
        "examplesWorking": true,
        "authenticationTested": true
      }
    }
  ],
  "executionLogs": [
    {
      "timestamp": "2023-08-15T10:34:00Z",
      "level": "info",
      "message": "Starting OpenAPI specification generation",
      "stepId": "step_001"
    },
    {
      "timestamp": "2023-08-15T10:38:30Z",
      "level": "info",
      "message": "Generated 15 endpoint definitions with examples",
      "stepId": "step_001"
    },
    {
      "timestamp": "2023-08-15T10:42:00Z",
      "level": "info",
      "message": "OpenAPI specification completed and validated",
      "stepId": "step_001"
    },
    {
      "timestamp": "2023-08-15T10:42:15Z",
      "level": "info",
      "message": "Starting multi-language code example generation",
      "stepId": "step_002"
    }
  ],
  "notifications": {
    "lastDiscordMessage": "2023-08-15T10:42:00Z",
    "pendingApprovals": 0,
    "alertsSent": 0
  },
  "metrics": {
    "averageStepDuration": 480000,
    "successRate": 1.0,
    "qualityScore": 0.96
  }
}
```

---

## Data Models

### Session Data Model

```json
{
  "sessionId": "string",
  "agentAuth": "string (JWT token)",
  "userSettings": {
    "name": "string",
    "email": "string (email format)",
    "preferences": {
      "aiAssistanceLevel": "enum: minimal|collaborative|aggressive",
      "autoSave": "boolean",
      "notificationChannels": ["array of enum: email|discord|webhook"]
    }
  },
  "githubConfig": {
    "repository": "string (format: owner/repo)",
    "branch": "string",
    "token": "string (encrypted)",
    "commitMessage": "string"
  },
  "sessionData": {
    "ideation": {
      "draftContent": "string",
      "versionHistory": ["array of VersionEntry"],
      "chatHistory": ["array of ChatMessage"],
      "drafts": ["array of DraftReference"]
    },
    "orchestration": {
      "taskDocument": "string",
      "workflowSteps": ["array of TaskStep"],
      "dependencies": "object (Map)",
      "executionStatus": "object"
    },
    "execution": {
      "checkpointDocument": "string",
      "logs": ["array of ExecutionLog"],
      "activeAgents": ["array of string"],
      "metrics": "object"
    },
    "merge": {
      "originalContent": "string",
      "modifiedContent": "string", 
      "mergedContent": "string",
      "conflicts": ["array of MergeConflict"],
      "validationStatus": "object"
    }
  },
  "workflowProgress": {
    "ideation": "enum: locked|available|current|completed",
    "orchestration": "enum: locked|available|current|completed",
    "execution": "enum: locked|available|current|completed",
    "merge": "enum: locked|available|current|completed"
  },
  "createdAt": "string (ISO 8601 datetime)",
  "lastAccessed": "string (ISO 8601 datetime)"
}
```

### Draft Data Model

```json
{
  "id": "string (draft ID)",
  "sessionId": "string",
  "title": "string (max 200 chars)",
  "description": "string (max 1000 chars)",
  "content": "string (max 100KB)",
  "metadata": {
    "tags": ["array of string"],
    "author": "string",
    "version": "string",
    "project": "string",
    "wordCount": "integer",
    "characterCount": "integer",
    "lineCount": "integer",
    "contentHash": "string (SHA-256)"
  },
  "version": "integer (starts at 1)",
  "versionHistory": [
    {
      "version": "integer",
      "timestamp": "string (ISO 8601 datetime)",
      "content": "string",
      "changes": {
        "added": "integer (lines added)",
        "removed": "integer (lines removed)",
        "modified": "integer (lines modified)",
        "total": "integer (total lines changed)"
      },
      "checkpointId": "string"
    }
  ],
  "status": "enum: draft|published|archived",
  "createdAt": "string (ISO 8601 datetime)",
  "lastModified": "string (ISO 8601 datetime)",
  "checkpointId": "string"
}
```

### Task Step Data Model

```json
{
  "id": "string (step ID)",
  "title": "string (max 200 chars)",
  "description": "string (max 1000 chars)",
  "estimatedDuration": "string (e.g., '8 minutes')",
  "assignedAgent": "string (agent type)",
  "dependencies": ["array of string (step IDs)"],
  "deliverables": ["array of string"],
  "validationCriteria": ["array of string"],
  "priority": "enum: low|medium|high|critical",
  "status": "enum: pending|executing|completed|failed",
  "metadata": {
    "tools": ["array of string"],
    "complexity": "enum: low|medium|high",
    "riskLevel": "enum: low|medium|high"
  }
}
```

### Checkpoint Data Model

```json
{
  "id": "string (checkpoint ID)",
  "sessionId": "string",
  "stepId": "string",
  "status": "enum: created|executing|completed|failed|expired",
  "integrityHash": "string (dual hash: sha3:xxx|blake3:yyy)",
  "metadata": {
    "agent": "string",
    "tools": ["array of string"],
    "description": "string",
    "priority": "enum: low|medium|high",
    "estimatedDuration": "string",
    "lockKey": "string",
    "created": "string (ISO 8601 datetime)"
  },
  "expectedDuration": "integer (milliseconds)",
  "dependencies": ["array of string (checkpoint IDs)"],
  "executionResults": {
    "executionId": "string",
    "startTime": "string (ISO 8601 datetime)",
    "endTime": "string (ISO 8601 datetime)",
    "duration": "integer (milliseconds)",
    "deliverables": ["array of DeliverableResult"],
    "logs": ["array of ExecutionLog"],
    "metrics": "object"
  },
  "timestamp": "string (ISO 8601 datetime)",
  "expiresAt": "string (ISO 8601 datetime)"
}
```

### Merge Conflict Data Model

```json
{
  "id": "string (conflict ID)",
  "type": "enum: content|structure|metadata",
  "line": "integer (line number)",
  "section": "string (section name)",
  "originalContent": "string",
  "modifiedContent": "string",
  "severity": "enum: low|medium|high|critical",
  "resolution": "enum: automatic|manual|ai_assisted",
  "suggestions": ["array of string"],
  "confidence": "number (0-1)",
  "semanticSimilarity": "number (0-1)",
  "resolutionData": {
    "strategy": "enum: accept_original|accept_modified|manual_merge|ai_suggestion",
    "customContent": "string (for manual_merge)",
    "reasoning": "string",
    "timestamp": "string (ISO 8601 datetime)"
  }
}
```

---

## WebSocket Events

### Connection

Connect to the WebSocket for real-time updates:

```javascript
const ws = new WebSocket('wss://terragon-vercel.vercel.app/api/collaboration/sync/websocket?sessionId=SESSION_ID&agentAuth=TOKEN');

ws.onopen = function(event) {
  console.log('Connected to collaboration sync');
};

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  handleWebSocketMessage(data);
};
```

### Event Types

#### Draft Update Event

```json
{
  "type": "draft_update",
  "timestamp": "2023-08-15T10:30:00Z",
  "sessionId": "collab_1691234567890_abc123def",
  "payload": {
    "draftId": "draft_1691234567890_xyz789",
    "version": 2,
    "title": "Updated Draft Title",
    "changes": {
      "added": 5,
      "removed": 1,
      "modified": 3
    },
    "updatedBy": "user_123"
  }
}
```

#### Execution Progress Event

```json
{
  "type": "execution_progress",
  "timestamp": "2023-08-15T10:35:00Z",
  "sessionId": "collab_1691234567890_abc123def",
  "payload": {
    "executionId": "exec_1691234567890_xyz789",
    "checkpointId": "checkpoint_1691234567890_abc123",
    "stepId": "step_001",
    "progress": {
      "completionPercentage": 65,
      "currentStep": "Validating OpenAPI schemas",
      "estimatedTimeRemaining": 168000
    },
    "status": "executing"
  }
}
```

#### Conflict Detected Event

```json
{
  "type": "conflict_detected",
  "timestamp": "2023-08-15T10:38:00Z",
  "sessionId": "collab_1691234567890_abc123def",
  "payload": {
    "conflictId": "conflict_001",
    "type": "content",
    "severity": "medium",
    "section": "## API Documentation",
    "description": "Conflicting changes detected in API documentation section",
    "requiresResolution": true
  }
}
```

#### User Joined Event

```json
{
  "type": "user_joined",
  "timestamp": "2023-08-15T10:32:00Z",
  "sessionId": "collab_1691234567890_abc123def",
  "payload": {
    "userId": "user_456",
    "name": "Jane Developer",
    "permissions": ["read", "write"],
    "currentPhase": "ideation"
  }
}
```

#### Phase Transition Event

```json
{
  "type": "phase_transition",
  "timestamp": "2023-08-15T10:40:00Z", 
  "sessionId": "collab_1691234567890_abc123def",
  "payload": {
    "fromPhase": "execution",
    "toPhase": "merge",
    "triggeredBy": "user_123",
    "prerequisites": ["all_checkpoints_completed"],
    "nextSteps": ["conflict_detection", "merge_resolution"]
  }
}
```

#### Error Event

```json
{
  "type": "error",
  "timestamp": "2023-08-15T10:41:00Z",
  "sessionId": "collab_1691234567890_abc123def",
  "payload": {
    "errorType": "checkpoint_execution_failed",
    "message": "Checkpoint execution failed due to validation error",
    "details": "OpenAPI schema validation failed for endpoint /users",
    "checkpointId": "checkpoint_1691234567890_abc123",
    "severity": "high",
    "requiresAction": true
  }
}
```

### Client-Side Event Handling

```javascript
function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'draft_update':
      updateDraftInUI(data.payload);
      showNotification(`Draft "${data.payload.title}" updated`);
      break;
      
    case 'execution_progress':
      updateProgressBar(data.payload.progress.completionPercentage);
      updateStatusText(data.payload.progress.currentStep);
      break;
      
    case 'conflict_detected':
      showConflictAlert(data.payload);
      highlightConflictingSection(data.payload.section);
      break;
      
    case 'user_joined':
      addUserToActiveList(data.payload);
      showNotification(`${data.payload.name} joined the session`);
      break;
      
    case 'phase_transition':
      updateWorkflowProgress(data.payload.toPhase);
      enablePhaseUI(data.payload.toPhase);
      break;
      
    case 'error':
      showErrorAlert(data.payload);
      if (data.payload.requiresAction) {
        promptUserAction(data.payload);
      }
      break;
      
    default:
      console.log('Unknown WebSocket event type:', data.type);
  }
}
```

---

## Code Examples

### Complete Integration Example

```javascript
// Complete integration example with error handling
class CollaborationClient {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.agentAuth = config.agentAuth;
    this.websocket = null;
    this.sessionId = null;
  }

  async initializeSession(userSettings, githubConfig) {
    try {
      const response = await fetch(`${this.baseUrl}/collaboration/session/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userSettings,
          githubConfig,
          initialMode: 'ideation'
        })
      });

      if (!response.ok) {
        throw new Error(`Session initialization failed: ${response.statusText}`);
      }

      const session = await response.json();
      this.sessionId = session.sessionId;
      this.agentAuth = session.agentAuth;

      // Connect to WebSocket for real-time updates
      await this.connectWebSocket();

      return session;
    } catch (error) {
      console.error('Session initialization error:', error);
      throw error;
    }
  }

  async connectWebSocket() {
    const wsUrl = `wss://${this.baseUrl.replace('https://', '').replace('http://', '')}/collaboration/sync/websocket?sessionId=${this.sessionId}&agentAuth=${this.agentAuth}`;
    
    this.websocket = new WebSocket(wsUrl);
    
    return new Promise((resolve, reject) => {
      this.websocket.onopen = () => {
        console.log('WebSocket connected');
        resolve();
      };
      
      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      this.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      };
    });
  }

  async completeCollaborationWorkflow(projectDescription) {
    console.log('🚀 Starting complete collaboration workflow...');

    // Phase 1: Ideation
    console.log('💡 Phase 1: Ideation');
    const ideationResults = await this.ideationPhase(projectDescription);

    // Phase 2: Orchestration
    console.log('🎯 Phase 2: Orchestration');
    const orchestrationResults = await this.orchestrationPhase(ideationResults);

    // Phase 3: Execution
    console.log('⚡ Phase 3: Execution');
    const executionResults = await this.executionPhase(orchestrationResults);

    // Phase 4: Merge
    console.log('🔀 Phase 4: Merge');
    const finalDocument = await this.mergePhase(executionResults);

    console.log('✅ Collaboration workflow completed successfully');
    return finalDocument;
  }

  async ideationPhase(projectDescription) {
    // Start AI-powered ideation
    const chatResponse = await this.makeRequest('POST', '/collaboration/ideation/chat', {
      sessionId: this.sessionId,
      message: `Help me create a comprehensive CLAUDE.md for: ${projectDescription}`,
      draftContent: '',
      aiMode: 'collaborative',
      chatHistory: []
    });

    // Create initial draft based on AI suggestions
    const draft = await this.makeRequest('POST', '/collaboration/drafts/create', {
      sessionId: this.sessionId,
      title: 'Project CLAUDE.md',
      content: this.generateInitialContent(chatResponse.response),
      description: 'AI-assisted initial draft'
    });

    // Iterative refinement
    let currentDraft = draft;
    for (let i = 0; i < 3; i++) {
      const refinementResponse = await this.makeRequest('POST', '/collaboration/ideation/chat', {
        sessionId: this.sessionId,
        message: `Please review and suggest improvements for iteration ${i + 1}`,
        draftContent: currentDraft.content,
        aiMode: 'critique',
        chatHistory: []
      });

      if (refinementResponse.proposedChanges.length > 0) {
        const updatedContent = this.applyChanges(currentDraft.content, refinementResponse.proposedChanges);
        const updatedDraft = await this.makeRequest('PUT', `/collaboration/drafts/${currentDraft.draftId}`, {
          content: updatedContent,
          changeDescription: `Iteration ${i + 1} improvements`
        });
        currentDraft = { ...currentDraft, ...updatedDraft };
      }
    }

    return currentDraft;
  }

  async orchestrationPhase(ideationResults) {
    const decomposition = await this.makeRequest('POST', '/collaboration/orchestration/decompose', {
      sessionId: this.sessionId,
      taskDescription: 'Implement and deploy the finalized CLAUDE.md document with comprehensive documentation',
      context: ideationResults.content,
      requirements: {
        targetDuration: '10 minutes',
        maxSteps: 15,
        includeValidation: true,
        generateDependencies: true
      }
    });

    console.log(`📋 Generated ${decomposition.steps.length} tasks`);
    console.log(`⏱️ Total estimated time: ${decomposition.metadata.estimatedTotalTime / 60000} minutes`);

    return decomposition;
  }

  async executionPhase(orchestrationResults) {
    const executionResults = [];

    for (const step of orchestrationResults.steps) {
      try {
        console.log(`🔄 Executing: ${step.title}`);

        // Create checkpoint
        const checkpoint = await this.makeRequest('POST', '/collaboration/checkpoints/create', {
          sessionId: this.sessionId,
          stepId: step.id,
          metadata: {
            agent: step.assignedAgent,
            description: step.description
          },
          expectedDuration: this.parseDuration(step.estimatedDuration)
        });

        // Execute checkpoint
        const execution = await this.makeRequest('POST', `/collaboration/checkpoints/${checkpoint.checkpointId}/execute`, {
          executionParams: {
            step: step,
            context: orchestrationResults
          },
          monitoringConfig: {
            realTimeUpdates: true,
            maxExecutionTime: 600000
          }
        });

        // Monitor progress
        await this.monitorExecution(execution.executionId);

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

  async mergePhase(executionResults) {
    // Check for conflicts
    const conflicts = await this.makeRequest('GET', '/collaboration/merge/conflicts', {
      sessionId: this.sessionId,
      originalHash: 'original_hash',
      modifiedHash: 'modified_hash'
    });

    if (conflicts.hasConflicts) {
      console.log(`⚠️ Found ${conflicts.conflicts.length} conflicts`);

      // Resolve conflicts
      const resolutions = conflicts.conflicts.map(conflict => ({
        conflictId: conflict.id,
        resolution: 'accept_modified'
      }));

      const mergeResult = await this.makeRequest('POST', '/collaboration/merge/resolve', {
        sessionId: this.sessionId,
        conflicts: resolutions,
        resolutionStrategy: 'balanced',
        validateIntegrity: true
      });

      return mergeResult.mergedContent;
    }

    return 'No conflicts - merge completed successfully';
  }

  async makeRequest(method, endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (this.agentAuth) {
      options.headers['X-Agent-Auth'] = `Bearer ${this.agentAuth}`;
    }

    if (data) {
      if (method === 'GET') {
        const params = new URLSearchParams(data);
        url += `?${params}`;
      } else {
        options.body = JSON.stringify(data);
      }
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API request failed: ${error.message}`);
    }

    return await response.json();
  }

  generateInitialContent(aiResponse) {
    return `# Project CLAUDE.md\n\n## AI-Generated Content\n\n${aiResponse}\n\n## Sacred Principles\n\n### ABSOLUTE RULES - NEVER VIOLATE\n1. **NO SIMULATIONS** - Never simulate, mock, or fake any functionality\n2. **NO FALLBACKS** - Get to the root of problems, never create workarounds\n3. **NO TEMPLATES** - Task decomposition must be 100% AI-driven and dynamic\n4. **NO ASSUMPTIONS** - Always check CLAUDE.md before asking questions\n5. **ALWAYS REAL** - Every interaction, API call, and execution must be genuine`;
  }

  applyChanges(content, changes) {
    // Simplified change application
    return content + '\n\n## AI Improvements\n' + changes.map(change => `- ${change.description}`).join('\n');
  }

  parseDuration(duration) {
    const match = duration.match(/(\d+)\s*(minute|hour)s?/);
    if (!match) return 600000; // 10 minutes default
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    return unit === 'hour' ? value * 60 * 60 * 1000 : value * 60 * 1000;
  }

  async monitorExecution(executionId) {
    return new Promise((resolve) => {
      const checkProgress = async () => {
        try {
          const status = await this.makeRequest('GET', `/collaboration/checkpoints/${executionId}/monitor`);
          
          if (status.status === 'completed' || status.status === 'failed') {
            resolve(status);
          } else {
            setTimeout(checkProgress, 5000); // Check every 5 seconds
          }
        } catch (error) {
          console.error('Error monitoring execution:', error);
          resolve({ status: 'failed', error: error.message });
        }
      };

      checkProgress();
    });
  }

  handleWebSocketMessage(data) {
    console.log(`📡 WebSocket event: ${data.type}`);
    
    switch (data.type) {
      case 'execution_progress':
        console.log(`⚡ Progress: ${data.payload.progress.completionPercentage}%`);
        break;
      case 'conflict_detected':
        console.log(`⚠️ Conflict detected: ${data.payload.description}`);
        break;
      case 'phase_transition':
        console.log(`🔄 Phase transition: ${data.payload.fromPhase} → ${data.payload.toPhase}`);
        break;
    }
  }
}

// Usage example
async function main() {
  const client = new CollaborationClient({
    baseUrl: 'https://terragon-vercel.vercel.app/api',
    agentAuth: 'your-agent-token'
  });

  try {
    // Initialize session
    const session = await client.initializeSession(
      {
        name: 'Developer',
        email: 'dev@example.com',
        preferences: {
          aiAssistanceLevel: 'collaborative',
          autoSave: true
        }
      },
      {
        repository: 'my-org/my-project',
        token: 'github-token'
      }
    );

    console.log(`🚀 Session initialized: ${session.sessionId}`);

    // Complete workflow
    const result = await client.completeCollaborationWorkflow(
      'Modern REST API with comprehensive documentation and testing'
    );

    console.log('🎉 Final result:', result);

  } catch (error) {
    console.error('❌ Workflow failed:', error);
  }
}

main();
```

This comprehensive API reference provides everything developers need to integrate with the Claude.md Collaboration System, including detailed examples, error handling patterns, and real-world usage scenarios.