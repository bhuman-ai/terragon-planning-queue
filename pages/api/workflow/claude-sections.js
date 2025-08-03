/**
 * API endpoint to list all linkable sections in CLAUDE.md
 * Helps users find the right section to link their tasks to
 */

import HierarchyManager from '../../../lib/workflow/hierarchy-manager';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const hierarchyManager = new HierarchyManager();
    const sections = await hierarchyManager.parseClaudeMd();

    // Group sections by top-level category
    const grouped = {};
    sections.forEach(section => {
      const topLevel = section.path.split(' → ')[0];
      if (!grouped[topLevel]) {
        grouped[topLevel] = [];
      }
      grouped[topLevel].push({
        id: section.id,
        path: section.path,
        title: section.title,
        lineNumber: section.lineNumber,
        level: section.level
      });
    });

    res.status(200).json({
      success: true,
      totalSections: sections.length,
      sections: grouped,
      usage: {
        hint: 'Use either the section ID or full path when creating tasks',
        example: {
          byId: { claudeMdSection: 'a1b2c3d4' },
          byPath: { claudeMdSection: 'Sacred Principles & AI Instructions → ABSOLUTE RULES - NEVER VIOLATE' }
        }
      }
    });

  } catch (error) {
    console.error('Error parsing CLAUDE.md:', error);

    res.status(500).json({
      error: 'Failed to parse CLAUDE.md sections',
      details: error.message
    });
  }
}
