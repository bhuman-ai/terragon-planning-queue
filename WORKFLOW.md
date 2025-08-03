# Workflow System Documentation

## Overview

The Terragon Planning Queue implements a strict hierarchical workflow system that ensures all changes follow a documented, validated path from conception to implementation.

## Hierarchy Structure

```
CLAUDE.md (Sacred Constitution - HOW to work)
    ↓
project.md (Current State - WHAT is built)
    ↓
task-XXX/task.md (Work Orchestration)
    ↓
task-XXX/checkpoints/checkpoint-YYY.md (Atomic Execution)
```

### Document Roles

1. **CLAUDE.md** - Immutable sacred document defining:
   - Development principles and philosophy
   - Architecture and technology stack
   - Workflows and processes
   - AI agent instructions

2. **project.md** - Mutable state document tracking:
   - Current project status
   - Component completion states
   - API endpoint statuses
   - Validation results

3. **task.md** - Work orchestration documents that:
   - Link to parent CLAUDE.md sections
   - Define objectives and requirements
   - Track checkpoint progress
   - Generate merge proposals when complete

4. **checkpoint.md** - Atomic execution units that:
   - Link to parent tasks
   - Define specific implementation steps
   - Include validation requirements
   - Must pass all checks before completion

## Using the Workflow

### CLI Commands

```bash
# List all CLAUDE.md sections
npm run workflow list-sections

# Create a new task linked to CLAUDE.md
npm run workflow create-task "Implement User Auth" --section "3.1"

# Create checkpoints within a task
npm run workflow create-checkpoint task-001 "Create auth component"

# Mark checkpoint as complete
npm run workflow complete-checkpoint task-001 checkpoint-001

# List all tasks and status
npm run workflow list-tasks

# Show task details
npm run workflow show-task task-001
```

### API Endpoints

#### Create Task
```bash
POST /api/workflow/create-task
{
  "title": "Implement User Authentication",
  "description": "Add OAuth2 authentication",
  "claudeMdSection": "Security Standards",
  "requirements": ["OAuth2 provider", "Session management"]
}
```

#### Create Checkpoint
```bash
POST /api/workflow/create-checkpoint
{
  "taskId": "task-001",
  "title": "Create auth component",
  "objective": "Build React component for login"
}
```

#### Update Checkpoint Status
```bash
PUT /api/workflow/update-checkpoint
{
  "taskId": "task-001",
  "checkpointId": "checkpoint-001",
  "status": "complete",
  "validationResults": {
    "eslint": true,
    "tests": true,
    "accessibility": true
  }
}
```

#### Get/Approve Merge Proposal
```bash
# Get proposal
GET /api/workflow/merge-proposal/task-001

# Approve proposal
POST /api/workflow/merge-proposal/task-001
{
  "action": "approve",
  "proposalId": "uuid-here",
  "reason": "All validations passed"
}
```

## Workflow Rules

1. **No Direct Edits**: project.md cannot be edited directly
2. **Parent Linkage Required**: All tasks must link to CLAUDE.md
3. **Checkpoint Completion**: All checkpoints must complete before merge
4. **Validation Gates**: All validations must pass
5. **Human Approval**: Merge proposals require approval

## Example Workflow

1. **Create Task**
   ```bash
   npm run workflow create-task "Add Dark Mode" --section "UI Components"
   ```

2. **Create Checkpoints**
   ```bash
   npm run workflow create-checkpoint task-002 "Create theme context"
   npm run workflow create-checkpoint task-002 "Add toggle component"
   npm run workflow create-checkpoint task-002 "Update styles"
   ```

3. **Complete Work**
   - Implement each checkpoint
   - Run validations
   - Mark as complete

4. **Review Merge Proposal**
   - All checkpoints complete → merge proposal generated
   - Review changes
   - Approve/reject

5. **Update project.md**
   - Apply approved changes
   - Update component status
   - Commit with proper message

## Folder Structure

```
/tasks/
  task-001-implement-auth/
    task.md                    # Task orchestration
    .task-metadata.json        # Task metadata and status
    /checkpoints/
      checkpoint-001-create-component.md
      checkpoint-002-add-oauth.md
    /artifacts/                # Task outputs
    /research/                 # Research materials
    merge-proposal-xxx.json    # Generated proposals
    merge-diff-xxx.md         # Merge instructions
```

## Visual Interface

Access the Workflow Hierarchy view in the web UI:
1. Navigate to main interface
2. Click "🔗 Workflow Hierarchy" tab
3. View CLAUDE.md → project.md → tasks → checkpoints
4. Monitor task status and progress

## Best Practices

1. **Link Meaningfully**: Choose CLAUDE.md sections that truly relate to your task
2. **Atomic Checkpoints**: Keep checkpoints small and testable
3. **Complete Validations**: Never skip validation steps
4. **Document Decisions**: Use progress logs in task.md
5. **Review Thoroughly**: Check merge proposals carefully

## Troubleshooting

### "Task must reference parent section"
- Use `list-sections` to find valid sections
- Or let the system suggest relevant sections

### "Checkpoint not found"
- Ensure task ID is correct
- Check checkpoint was created first

### "Direct edit forbidden"
- Follow the workflow: task → checkpoint → merge
- Never edit project.md directly

### "Validation failed"
- Run the specific validation locally
- Fix issues before marking complete
- Check sacred principles compliance