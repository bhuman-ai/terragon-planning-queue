import { useState } from 'react';
import CollaborationHub from '../components/collaboration/CollaborationHub';

/**
 * Collaboration Demo Page
 * Demonstrates the 4 specialized UI views for Claude.md collaboration
 */
export default function CollaborationDemo() {
  const [userSettings] = useState({
    userId: 'demo_user',
    preferences: {
      aiAssistanceLevel: 'high',
      autoSave: true,
      realTimeCollaboration: true
    }
  });

  const [githubConfig] = useState({
    owner: 'demo',
    repo: 'terragon-vercel',
    branch: 'main'
  });

  const handleSessionUpdate = (sessionData) => {
    console.log('Session updated:', sessionData);
  };

  return (
    <div style={{
      height: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <CollaborationHub
        userSettings={userSettings}
        githubConfig={githubConfig}
        onSessionUpdate={handleSessionUpdate}
        initialMode="ideation"
      />
    </div>
  );
}