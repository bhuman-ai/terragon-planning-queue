# Terragon Planning Queue - Project Source of Truth (project.md)

> **⚠️ SACRED DOCUMENT**: This is the single source of truth for the project state. 
> All modifications must flow through validated task.md → checkpoint.md workflow.
> Direct edits are forbidden without completed validation gates.

## Project Overview
- **Name**: Terragon Planning Queue
- **Version**: 1.0.0
- **Status**: Active Development
- **Last Updated**: 2025-08-03

## Components Library

### Core Components
| Component | Status | Validation | Path |
|-----------|--------|------------|------|
| PreResearchModal | ✅ Complete | Passed | `/components/PreResearchModal.js` |
| PostResearchModal | ✅ Complete | Passed | `/components/PostResearchModal.js` |
| ProposalReviewModal | ✅ Complete | Passed | `/components/ProposalReviewModal.js` |
| CalibrationWizard | ✅ Complete | Passed | `/components/CalibrationWizard.js` |

### Collaboration Components
| Component | Status | Validation | Path |
|-----------|--------|------------|------|
| CollaborationHub | ✅ Complete | Passed | `/components/collaboration/CollaborationHub.js` |
| IdeationView | ✅ Complete | Passed | `/components/collaboration/IdeationView.js` |
| TaskOrchestrationView | ✅ Complete | Passed | `/components/collaboration/TaskOrchestrationView.js` |
| ExecutionView | ✅ Complete | Passed | `/components/collaboration/ExecutionView.js` |
| MergeReviewView | ✅ Complete | Passed | `/components/collaboration/MergeReviewView.js` |

### Pending Components
| Component | Status | Priority | Planned Path |
|-----------|--------|----------|--------------|
| SubmitButton | 🔄 Pending | High | `/components/ui/SubmitButton.js` |
| ErrorBoundary | 📋 Planned | Medium | `/components/ErrorBoundary.js` |
| LoadingSpinner | 📋 Planned | Low | `/components/ui/LoadingSpinner.js` |

## API Endpoints

### Meta-Agent APIs
| Endpoint | Method | Status | Validation |
|----------|--------|--------|------------|
| `/api/meta-agent/decompose` | POST | ✅ Complete | Passed |
| `/api/meta-agent/requirements` | POST | ✅ Complete | Passed |
| `/api/meta-agent/research` | POST | ✅ Complete | Passed |

### Collaboration APIs
| Endpoint | Method | Status | Validation |
|----------|--------|--------|------------|
| `/api/collaboration/sessions/create` | POST | ✅ Complete | Passed |
| `/api/collaboration/agents/auth` | POST | ✅ Complete | Passed |
| `/api/collaboration/validate-llm-output` | POST | ✅ Complete | Passed |

## Testing Infrastructure

### Validation Systems
| System | Status | Coverage | Config |
|--------|--------|----------|--------|
| ESLint LLM Validation | ✅ Active | 100% | `/.eslintrc.js` |
| Schema Validation | ✅ Active | 6 schemas | `/lib/collaboration/llm-schemas.js` |
| DOM Testing | ✅ Active | 5 components | `/lib/dom-testing/dom-validator.js` |
| Sacred Principles | ✅ Enforced | All files | `/scripts/validate-llm-code.js` |

## Deployment Configuration
- **Platform**: Vercel
- **Team**: bhuman
- **URL**: https://terragon-vercel-six.vercel.app
- **Environment**: Production
- **Cron Jobs**: Active (5-minute intervals)

## Document Hierarchy
```
project.md (this file) - Sacred source of truth
    └── task.md files - Task orchestration layer
            └── checkpoint.md files - Atomic execution units
```

## Validation Gates
All changes must pass:
1. ✅ ESLint validation (<100ms)
2. ✅ Schema validation (binary pass/fail)
3. ✅ DOM testing (component structure)
4. ✅ Sacred principles compliance
5. ✅ Human approval for project.md merge

---
*This document is protected by the sacred workflow. Modifications require validated task completion.*