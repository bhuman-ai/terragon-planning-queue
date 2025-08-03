# GitHub Token Setup for Calibration Scanning

The calibration scanning feature requires a GitHub Personal Access Token to access repository information through the GitHub API.

## How to Create a GitHub Token

1. Go to GitHub Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
   Or visit: https://github.com/settings/tokens

2. Click "Generate new token (classic)"

3. Give it a descriptive name like "Terragon Calibration Scanner"

4. Select the following scopes:
   - `repo` (Full control of private repositories) - if scanning private repos
   - `public_repo` (Access public repositories) - if only scanning public repos

5. Click "Generate token" and copy the token

6. Add it to your `.env.local` file:
   ```
   GITHUB_TOKEN="ghp_yourTokenHere"
   ```

## Token Permissions

The minimal permissions needed:
- Read access to repository contents
- Read access to repository metadata

## Security Note

- Never commit your GitHub token to version control
- The `.env.local` file is already in `.gitignore`
- Regenerate the token periodically for security
- Use tokens with minimal required permissions