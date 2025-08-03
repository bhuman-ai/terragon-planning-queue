/**
 * API endpoint to validate project.md edits
 * Enforces that all changes must come through the task → checkpoint workflow
 */

import HierarchyManager from '../../../lib/workflow/hierarchy-manager';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { proposedChanges, mergeProposalId } = req.body;

    if (!proposedChanges) {
      return res.status(400).json({
        error: 'Missing required field: proposedChanges'
      });
    }

    const hierarchyManager = new HierarchyManager();
    const validation = await hierarchyManager.validateProjectMdEdit(
      proposedChanges,
      mergeProposalId
    );

    if (!validation.allowed) {
      return res.status(403).json({
        allowed: false,
        error: validation.error,
        instruction: validation.instruction,
        workflow: {
          step1: 'Create a task linked to CLAUDE.md using /api/workflow/create-task',
          step2: 'Create checkpoints for atomic work units using /api/workflow/create-checkpoint',
          step3: 'Complete all checkpoints with validation',
          step4: 'Review and approve the auto-generated merge proposal',
          step5: 'Apply approved changes to project.md'
        }
      });
    }

    res.status(200).json({
      allowed: true,
      mergeProposal: validation.proposal,
      message: 'Project.md edit is allowed with approved merge proposal'
    });

  } catch (error) {
    console.error('Error validating project.md edit:', error);

    res.status(500).json({
      error: 'Failed to validate project.md edit',
      details: error.message
    });
  }
}
