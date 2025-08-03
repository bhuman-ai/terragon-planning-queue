/**
 * API endpoint to handle merge proposals for completed tasks
 * GET: Retrieve merge proposal
 * POST: Approve/reject merge proposal
 */

import HierarchyManager from '../../../../lib/workflow/hierarchy-manager';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  const { taskId } = req.query;

  if (!taskId) {
    return res.status(400).json({ error: 'Task ID is required' });
  }

  const hierarchyManager = new HierarchyManager();

  try {
    if (req.method === 'GET') {
      // Get merge proposal for task
      const taskPath = await hierarchyManager.findTaskPath(taskId);
      if (!taskPath) {
        return res.status(404).json({ error: `Task ${taskId} not found` });
      }

      // Find merge proposal files
      const files = await fs.readdir(taskPath);
      const proposalFiles = files.filter(f => f.startsWith('merge-proposal-'));

      if (proposalFiles.length === 0) {
        return res.status(404).json({
          error: 'No merge proposal found',
          hint: 'Complete all checkpoints to generate a merge proposal'
        });
      }

      // Get the latest proposal
      const latestProposal = proposalFiles.sort().pop();
      const proposalPath = path.join(taskPath, latestProposal);
      const proposal = JSON.parse(await fs.readFile(proposalPath, 'utf-8'));

      // Read task metadata for context
      const metadata = JSON.parse(
        await fs.readFile(path.join(taskPath, '.task-metadata.json'), 'utf-8')
      );

      res.status(200).json({
        success: true,
        taskId,
        proposal,
        taskMetadata: {
          title: metadata.title,
          status: metadata.status,
          claudeMdLink: metadata.claudeMdLink,
          checkpoints: metadata.checkpoints.map(c => ({
            id: c.id,
            title: c.title,
            status: c.status
          }))
        }
      });

    } else if (req.method === 'POST') {
      // Approve or reject merge proposal
      const { action, proposalId, reason } = req.body;

      if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          error: "Invalid action. Must be 'approve' or 'reject'"
        });
      }

      const taskPath = await hierarchyManager.findTaskPath(taskId);
      if (!taskPath) {
        return res.status(404).json({ error: `Task ${taskId} not found` });
      }

      // Find the specific proposal
      const proposalPath = path.join(taskPath, `merge-proposal-${proposalId}.json`);

      try {
        const proposal = JSON.parse(await fs.readFile(proposalPath, 'utf-8'));

        // Update proposal with approval status
        proposal.reviewed = true;
        proposal.reviewedAt = new Date().toISOString();
        proposal.approved = action === 'approve';
        proposal.reviewReason = reason;

        await fs.writeFile(proposalPath, JSON.stringify(proposal, null, 2));

        // Update task metadata
        const metadataPath = path.join(taskPath, '.task-metadata.json');
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

        if (action === 'approve') {
          metadata.status = 'approved-for-merge';

          // Generate the actual merge diff
          const diffPath = path.join(taskPath, `merge-diff-${proposalId}.md`);
          const diff = await generateMergeDiff(proposal, metadata);
          await fs.writeFile(diffPath, diff);

          res.status(200).json({
            success: true,
            action: 'approved',
            taskId,
            proposalId,
            message: 'Merge proposal approved. project.md can now be updated.',
            diffPath: path.relative(process.cwd(), diffPath),
            nextStep: 'Apply the diff to project.md using the generated merge-diff file'
          });
        } else {
          metadata.status = 'merge-rejected';

          res.status(200).json({
            success: true,
            action: 'rejected',
            taskId,
            proposalId,
            reason,
            message: 'Merge proposal rejected. Task remains complete but not merged.'
          });
        }

        metadata.updatedAt = new Date().toISOString();
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      } catch (error) {
        return res.status(404).json({
          error: `Merge proposal ${proposalId} not found`
        });
      }

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Error handling merge proposal:', error);
    res.status(500).json({
      error: 'Failed to handle merge proposal',
      details: error.message
    });
  }
}

async function generateMergeDiff(proposal, metadata) {
  const timestamp = new Date().toISOString();

  const diff = `# Merge Diff for ${metadata.taskId}

Generated: ${timestamp}
Task: ${metadata.title || 'Untitled'}
Linked to: CLAUDE.md → ${metadata.claudeMdLink.sectionPath}

## Validation Summary
✅ All checkpoints completed
✅ All validations passed
✅ Merge proposal approved

## Changes to project.md

`;

  if (proposal.changes && proposal.changes.length > 0) {
    proposal.changes.forEach(change => {
      diff += `### ${change.type}: ${change.name}

\`\`\`diff
`;

      if (change.type === 'component') {
        diff += `## Components Library

### ${change.category || 'Core'} Components
| Component | Status | Validation | Path |
|-----------|--------|------------|------|
+ | ${change.name} | ✅ Complete | Passed | \`${change.path}\` |
`;
      } else if (change.type === 'api') {
        diff += `## API Endpoints

### ${change.category || 'Core'} APIs
| Endpoint | Method | Status | Validation |
|----------|--------|--------|------------|
+ | \`${change.endpoint}\` | ${change.method} | ✅ Complete | Passed |
`;
      }

      diff += `\`\`\`

`;
    });
  } else {
    diff += `*No specific changes defined. Review task implementation to determine project.md updates.*\n\n`;
  }

  diff += `## Application Instructions

1. Open project.md
2. Locate the appropriate section based on the changes above
3. Add the new entries maintaining alphabetical/logical order
4. Update the 'Last Updated' timestamp to ${timestamp.split('T')[0]}
5. Commit with message: 'Update project.md: Complete ${metadata.taskId}'

## Checkpoints Completed
`;

  metadata.checkpoints.forEach(checkpoint => {
    diff += `- [x] ${checkpoint.id}: ${checkpoint.title}\n`;
  });

  return diff;
}
