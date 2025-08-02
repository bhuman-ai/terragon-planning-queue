# Terragon Session Token Guide

## How to Get Your Session Token

### Method 1: Chrome/Edge Browser
1. **Log in to Terragon**: Go to https://www.terragonlabs.com and sign in
2. **Open Developer Tools**: Press `F12` or right-click → "Inspect"
3. **Navigate to Cookies**:
   - Click on "Application" tab (Chrome) or "Storage" tab (Firefox)
   - In the left sidebar, expand "Cookies"
   - Click on "https://www.terragonlabs.com"
4. **Find the Session Cookie**:
   - Look for a cookie named `__session`
   - Click on it to see the full value
   - The value will be a long string starting with `eyJ...`
5. **Copy the Value**: 
   - Double-click the Value field
   - Copy the entire string (it's very long!)
   - This is your session token

### Method 2: Safari Browser
1. Enable Developer menu: Safari → Preferences → Advanced → Show Develop menu
2. Log in to Terragon
3. Develop → Show Web Inspector
4. Storage → Cookies → terragonlabs.com
5. Find `__session` and copy its value

### Method 3: Using Console (Any Browser)
1. Log in to Terragon
2. Open Developer Console (F12)
3. In the Console tab, type:
   ```javascript
   document.cookie.split(';').find(c => c.includes('__session')).split('=')[1]
   ```
4. Press Enter and copy the output

## Session Token Details

### Duration
- **Typical Duration**: 24-48 hours
- **Varies by**: Your account settings and activity
- **Auto-refresh**: Active use may extend the session
- **Hard limit**: Usually expires after 7 days max

### Security Notes
- **Keep it secret**: This token gives full access to your Terragon account
- **Don't share**: Never post it publicly or commit to git
- **Browser-specific**: Token is tied to your browser session
- **IP restrictions**: May be invalidated if used from different locations

### When Sessions Expire

Signs your session has expired:
- API calls return 401 or 403 errors
- Redirected to login page
- "Invalid session" error in the app

### Best Practices

1. **Regular Updates**: Get a fresh token daily for reliable operation
2. **Multiple Tokens**: You can have multiple active sessions
3. **Automation**: Consider using a password manager to store tokens
4. **Monitoring**: Check token validity before important tasks

## Troubleshooting

### "Invalid Session" Error
- Token has expired - get a new one
- Token was copied incorrectly - ensure you got the full string
- Terragon logged you out - sign in again

### "Session Not Found"
- Cookie name might be different - look for other auth cookies
- Try incognito/private mode
- Clear cookies and login fresh

### Token Looks Too Short
- Make sure you're copying the VALUE, not the name
- The token should be 200+ characters long
- Starts with `eyJ` (base64 encoded JWT)

## Automating Token Retrieval

For power users, you can create a bookmarklet:

```javascript
javascript:(function(){
  const token = document.cookie.split(';').find(c => c.includes('__session'))?.split('=')[1];
  if(token) {
    navigator.clipboard.writeText(token);
    alert('Session token copied to clipboard!');
  } else {
    alert('No session token found. Make sure you are logged in to Terragon.');
  }
})();
```

Save this as a bookmark and click it when on Terragon to quickly copy your token.

## Alternative: Browser Extension

Consider creating a simple browser extension that:
1. Auto-detects when you're on Terragon
2. Extracts the session token
3. Optionally auto-fills it in your planning queue app

## Session Management Tips

1. **Morning Routine**: Get a fresh token each morning
2. **Calendar Reminder**: Set a daily reminder to update token
3. **Multiple Accounts**: Use different browsers for different accounts
4. **Token Rotation**: Don't rely on one token for critical tasks

## Future Improvements

We could enhance the app to:
- Show token expiration warnings
- Auto-detect expired tokens
- Provide token refresh reminders
- Support multiple tokens/accounts