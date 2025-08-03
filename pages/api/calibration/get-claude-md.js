/**
 * Get CLAUDE.md content from repository
 * Fetches the sacred document from GitHub with proper error handling
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { owner, repo, branch = 'main' } = req.body;

  if (!owner || !repo) {
    return res.status(400).json({ error: 'Owner and repo are required' });
  }

  try {
    // Build GitHub API URL
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/CLAUDE.md?ref=${branch}`;

    // Prepare headers
    const headers = {
      'Accept': 'application/vnd.github.v3.raw',
      'User-Agent': 'Terragon-Planning-Queue'
    };

    // Add GitHub token if available for private repos
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    console.log(`📖 Fetching CLAUDE.md from ${owner}/${repo}:${branch}`);

    // Fetch CLAUDE.md content
    const response = await fetch(apiUrl, { headers });

    if (response.status === 404) {
      return res.status(200).json({
        content: generatePlaceholderClaudeMd(owner, repo),
        exists: false,
        lastModified: null,
        message: 'CLAUDE.md not found - showing template'
      });
    }

    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Repository is private or GitHub token is invalid'
        });
      }

      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    // Get content
    const content = await response.text();

    // Get file metadata for last modified date
    let lastModified = null;
    try {
      const metadataUrl = `https://api.github.com/repos/${owner}/${repo}/contents/CLAUDE.md?ref=${branch}`;
      const metadataResponse = await fetch(metadataUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Terragon-Planning-Queue',
          ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` })
        }
      });

      if (metadataResponse.ok) {
        await metadataResponse.json();

        // Get commit info for the file
        const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=CLAUDE.md&per_page=1`;
        const commitsResponse = await fetch(commitsUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Terragon-Planning-Queue',
            ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` })
          }
        });

        if (commitsResponse.ok) {
          const commits = await commitsResponse.json();
          if (commits.length > 0) {
            lastModified = commits[0].commit.committer.date;
          }
        }
      }
    } catch (metadataError) {
      console.log('Could not fetch metadata:', metadataError.message);
    }

    res.status(200).json({
      content,
      exists: true,
      lastModified,
      repository: `${owner}/${repo}`,
      branch,
      size: content.length,
      message: 'CLAUDE.md loaded successfully'
    });

  } catch (error) {
    console.error(`❌ Error fetching CLAUDE.md from ${owner}/${repo}:`, error);

    res.status(500).json({
      error: 'Failed to fetch CLAUDE.md',
      message: error.message,
      repository: `${owner}/${repo}`
    });
  }
}

/**
 * Generate placeholder CLAUDE.md when file doesn't exist
 */
function generatePlaceholderClaudeMd(owner, repo) {
  return `# ${repo} - Sacred Master Document (CLAUDE.md)

## ⚠️ Repository Not Calibrated

This repository has not been calibrated yet. The sacred CLAUDE.md document needs to be created to establish:

### Missing Components:
- **Project Vision & Overview** - What this project aims to achieve
- **Sacred Principles** - Inviolable rules that guide all development
- **Technology Stack** - Current frameworks, libraries, and tools
- **Architecture** - How the system is structured
- **Development Standards** - Coding practices and conventions
- **Deployment Guidelines** - How the project is deployed and maintained

### Next Steps:
1. **Run Calibration**: Use the calibration wizard to create your sacred document
2. **Project Interview**: Answer questions about your project's goals and structure
3. **Document Generation**: AI will analyze your codebase and create CLAUDE.md
4. **Review & Approve**: Confirm the generated document aligns with your vision
5. **Activate Sacred Governance**: Enable automated maintenance and drift detection

### Why CLAUDE.md Matters:
- **Single Source of Truth**: All project decisions reference this document
- **AI Agent Guidance**: Meta-agents use this for context and decision-making
- **Quality Assurance**: Prevents drift from established principles
- **Team Alignment**: Ensures everyone understands project direction
- **Living Documentation**: Automatically updated as project evolves

---

**Repository**: ${owner}/${repo}
**Status**: 🔴 Not Calibrated
**Action Required**: Initialize sacred document through calibration process

*This is a placeholder document. Run calibration to create your actual CLAUDE.md.*`;
}
