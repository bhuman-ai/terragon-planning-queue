import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ClaudeMdViewer from '../components/ClaudeMdViewer';

export default function ClaudeMdPage() {
  const router = useRouter();
  const [githubConfig, setGithubConfig] = useState(null);
  const [userSettings, setUserSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load GitHub configuration
    const savedGithub = localStorage.getItem('githubConfig');
    if (savedGithub) {
      try {
        const config = JSON.parse(savedGithub);
        setGithubConfig(config);
      } catch (error) {
        console.error('Error loading GitHub config:', error);
      }
    }

    // Load user settings
    const savedUserSettings = localStorage.getItem('meta-agent-user-settings');
    if (savedUserSettings) {
      try {
        const settings = JSON.parse(savedUserSettings);
        setUserSettings(settings);
      } catch (error) {
        console.error('Error loading user settings:', error);
      }
    }

    setIsLoading(false);
  }, []);

  const handleGoBack = () => {
    router.push('/');
  };

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        color: '#e0e0e0',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid #333',
          borderTop: '4px solid #00ff88',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <h2 style={{ color: '#00ff88', margin: 0 }}>Loading Sacred Document Viewer...</h2>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!githubConfig || !githubConfig.owner || !githubConfig.repo) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        color: '#e0e0e0',
        flexDirection: 'column',
        padding: '40px'
      }}>
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <h1 style={{ color: '#ff6666', marginBottom: '20px', fontSize: '24px' }}>
            ⚠️ Configuration Required
          </h1>

          <p style={{ color: '#ccc', marginBottom: '30px', lineHeight: '1.6' }}>
            To view CLAUDE.md documents, you need to configure your GitHub repository settings first.
          </p>

          <div style={{
            backgroundColor: '#0f0f0f',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '30px',
            textAlign: 'left'
          }}>
            <h3 style={{ color: '#00ff88', marginBottom: '15px', fontSize: '16px' }}>
              Required Settings:
            </h3>
            <ul style={{ color: '#aaa', lineHeight: '1.8', paddingLeft: '20px' }}>
              <li>GitHub repository owner</li>
              <li>GitHub repository name</li>
              <li>Valid repository access</li>
            </ul>
          </div>

          <button
            onClick={handleGoBack}
            style={{
              padding: '12px 24px',
              backgroundColor: '#00ff88',
              color: '#0a0a0a',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.3s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#00cc6a'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#00ff88'}
          >
            ← Go Back to Configure
          </button>
        </div>
      </div>
    );
  }

  return <ClaudeMdViewer githubConfig={githubConfig} userSettings={userSettings} />;
}
