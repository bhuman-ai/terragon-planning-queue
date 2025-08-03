import { useState, useEffect, useRef } from 'react';

export default function ClaudeMdViewer({ githubConfig, userSettings }) {
  const [claudeMdContent, setClaudeMdContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your Meta-Agent assistant. I can help you understand, update, and maintain your CLAUDE.md sacred document. What would you like to know?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [availableRepos, setAvailableRepos] = useState([]);
  const chatEndRef = useRef(null);
  const [viewMode, setViewMode] = useState('rendered'); // 'rendered' or 'raw'

  // Initialize with current repo
  useEffect(() => {
    if (githubConfig?.owner && githubConfig?.repo) {
      const currentRepo = {
        name: `${githubConfig.owner}/${githubConfig.repo}`,
        owner: githubConfig.owner,
        repo: githubConfig.repo
      };
      setSelectedRepo(currentRepo);
      loadAvailableRepos();
    }
  }, [githubConfig]);

  // Load CLAUDE.md when repo changes
  useEffect(() => {
    if (selectedRepo) {
      loadClaudeMd();
    }
  }, [selectedRepo]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadAvailableRepos = async () => {
    // For now, just use the current repo. Later this could fetch from user's GitHub
    if (githubConfig?.owner && githubConfig?.repo) {
      setAvailableRepos([{
        name: `${githubConfig.owner}/${githubConfig.repo}`,
        owner: githubConfig.owner,
        repo: githubConfig.repo
      }]);
    }
  };

  const loadClaudeMd = async () => {
    if (!selectedRepo) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/calibration/get-claude-md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: selectedRepo.owner,
          repo: selectedRepo.repo,
          branch: 'main'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setClaudeMdContent(data.content || '# CLAUDE.md not found\n\nThis repository has not been calibrated yet.');
        setLastUpdated(data.lastModified || null);

        // Update chat context
        addChatMessage('system', `Loaded CLAUDE.md from ${selectedRepo.name}`);
      } else {
        throw new Error(`Failed to load CLAUDE.md: ${response.status}`);
      }
    } catch (err) {
      console.error('Error loading CLAUDE.md:', err);
      setError(err.message);
      setClaudeMdContent('# Error Loading CLAUDE.md\n\nFailed to load the sacred document. Please check your GitHub configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const addChatMessage = (role, content, metadata = {}) => {
    const message = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...metadata
    };
    setChatMessages(prev => [...prev, message]);
  };

  const sendChatMessage = async () => {
    if (!currentMessage.trim() || isChatLoading) return;

    const userMessage = currentMessage.trim();
    setCurrentMessage('');

    // Add user message
    addChatMessage('user', userMessage);

    setIsChatLoading(true);

    try {
      const response = await fetch('/api/meta-agent/claude-md-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          claudeMdContent: claudeMdContent,
          repoInfo: selectedRepo,
          userSettings: userSettings,
          chatHistory: chatMessages.slice(-10) // Last 10 messages for context
        })
      });

      if (response.ok) {
        const data = await response.json();
        addChatMessage('assistant', data.response, {
          suggestions: data.suggestions,
          actions: data.actions
        });

        // If the assistant suggests an action, handle it
        if (data.action) {
          handleAssistantAction(data.action);
        }
      } else {
        throw new Error(`Chat failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Chat error:', error);
      addChatMessage('assistant', `Sorry, I encountered an error: ${error.message}. Please try again.`);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleAssistantAction = async (action) => {
    switch (action.type) {
      case 'refresh_document':
        await loadClaudeMd();
        break;
      case 'trigger_update':
        await triggerDocumentUpdate();
        break;
      case 'create_backup':
        await createBackup();
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  const triggerDocumentUpdate = async () => {
    addChatMessage('assistant', '🔄 Triggering automatic document update...');

    try {
      const response = await fetch('/api/claude-md/auto-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update' })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.updated) {
          addChatMessage('assistant', '✅ CLAUDE.md has been updated! Refreshing content...');
          await loadClaudeMd();
        } else {
          addChatMessage('assistant', `ℹ️ ${result.message}`);
        }
      }
    } catch (error) {
      addChatMessage('assistant', `❌ Update failed: ${error.message}`);
    }
  };

  const createBackup = async () => {
    addChatMessage('assistant', '💾 Creating backup...');

    try {
      const response = await fetch('/api/claude-md/auto-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup' })
      });

      if (response.ok) {
        addChatMessage('assistant', '✅ Backup created successfully!');
      }
    } catch (error) {
      addChatMessage('assistant', `❌ Backup failed: ${error.message}`);
    }
  };

  const renderMarkdown = (content) => {
    // Simple markdown rendering - in production you'd use a proper markdown parser
    return content
      .replace(/^# (.*$)/gm, '<h1 style="color: #00ff88; border-bottom: 2px solid #333; padding-bottom: 10px; margin: 20px 0 15px 0;">$1</h1>')
      .replace(/^## (.*$)/gm, '<h2 style="color: #66bbff; margin: 20px 0 10px 0;">$2</h2>')
      .replace(/^### (.*$)/gm, '<h3 style="color: #ffaa66; margin: 15px 0 8px 0;">$1</h3>')
      .replace(/^\*\*(.*?)\*\*/gm, '<strong style="color: #fff;">$1</strong>')
      .replace(/^\* (.*$)/gm, '<li style="margin: 5px 0;">$1</li>')
      .replace(/^- (.*$)/gm, '<li style="margin: 5px 0;">$1</li>')
      .replace(/`([^`]+)`/g, '<code style="background: #333; color: #ffaa66; padding: 2px 4px; border-radius: 3px;">$1</code>')
      .replace(/\n/g, '<br/>');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      backgroundColor: '#0a0a0a',
      color: '#e0e0e0'
    }}>
      {/* Left Panel - CLAUDE.md Viewer */}
      <div style={{
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #333'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #333',
          backgroundColor: '#1a1a1a'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h1 style={{ color: '#00ff88', margin: 0, fontSize: '24px' }}>
              📜 Sacred Document Viewer
            </h1>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setViewMode(viewMode === 'rendered' ? 'raw' : 'rendered')}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#333',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {viewMode === 'rendered' ? '📝 Raw' : '🎨 Rendered'}
              </button>
              <button
                onClick={loadClaudeMd}
                disabled={isLoading}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#0066cc',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  opacity: isLoading ? 0.6 : 1
                }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* Repository Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '14px' }}>
            <span style={{ color: '#888' }}>Repository:</span>
            <select
              value={selectedRepo?.name || ''}
              onChange={(e) => {
                const repo = availableRepos.find(r => r.name === e.target.value);
                setSelectedRepo(repo);
              }}
              style={{
                padding: '6px 10px',
                backgroundColor: '#0f0f0f',
                border: '1px solid #333',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '14px'
              }}
            >
              {availableRepos.map(repo => (
                <option key={repo.name} value={repo.name}>
                  {repo.name}
                </option>
              ))}
            </select>
            {lastUpdated && (
              <span style={{ color: '#666', fontSize: '12px' }}>
                Updated: {new Date(lastUpdated).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px'
        }}>
          {isLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              flexDirection: 'column',
              gap: '15px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid #333',
                borderTop: '3px solid #00ff88',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ color: '#888' }}>Loading sacred document...</span>
            </div>
          ) : error ? (
            <div style={{
              backgroundColor: '#331111',
              border: '1px solid #aa4444',
              borderRadius: '8px',
              padding: '20px',
              color: '#ff6666'
            }}>
              <h3 style={{ color: '#ff6666', margin: '0 0 10px 0' }}>❌ Error</h3>
              {error}
            </div>
          ) : viewMode === 'rendered' ? (
            <div
              style={{
                lineHeight: '1.6',
                fontSize: '14px',
                color: '#e0e0e0'
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(claudeMdContent) }}
            />
          ) : (
            <pre style={{
              backgroundColor: '#0f0f0f',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '20px',
              overflow: 'auto',
              fontSize: '13px',
              fontFamily: 'Monaco, Menlo, monospace',
              color: '#e0e0e0',
              whiteSpace: 'pre-wrap'
            }}>
              {claudeMdContent}
            </pre>
          )}
        </div>
      </div>

      {/* Right Panel - Meta-Agent Chat */}
      <div style={{
        width: '400px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1a1a'
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #333'
        }}>
          <h2 style={{ color: '#66bbff', margin: 0, fontSize: '18px' }}>
            🤖 Meta-Agent Assistant
          </h2>
          <p style={{ color: '#888', fontSize: '12px', margin: '5px 0 0 0' }}>
            Ask questions about your CLAUDE.md document
          </p>
        </div>

        {/* Chat Messages */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '15px'
        }}>
          {chatMessages.map((message, index) => (
            <div key={index} style={{
              marginBottom: '15px',
              display: 'flex',
              flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
              gap: '10px'
            }}>
              {/* Avatar */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: message.role === 'user' ? '#0066cc' : '#00aa44',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0
              }}>
                {message.role === 'user' ? '👤' : '🤖'}
              </div>

              {/* Message */}
              <div style={{
                flex: 1,
                maxWidth: '85%'
              }}>
                <div style={{
                  backgroundColor: message.role === 'user' ? '#003366' :
                    message.role === 'system' ? '#333' : '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '14px',
                  lineHeight: '1.4'
                }}>
                  {message.content}
                </div>

                {/* Timestamp */}
                <div style={{
                  fontSize: '11px',
                  color: '#666',
                  marginTop: '4px',
                  textAlign: message.role === 'user' ? 'right' : 'left'
                }}>
                  {formatTimestamp(message.timestamp)}
                </div>

                {/* Action Suggestions */}
                {message.suggestions && message.suggestions.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    {message.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentMessage(suggestion)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#333',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          color: '#ccc',
                          cursor: 'pointer',
                          fontSize: '11px',
                          marginRight: '5px',
                          marginBottom: '5px'
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isChatLoading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '15px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#00aa44',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}>
                🤖
              </div>
              <div style={{
                backgroundColor: '#0f0f0f',
                border: '1px solid #333',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '14px',
                color: '#888'
              }}>
                <span>Thinking</span>
                <span style={{ animation: 'pulse 1.5s infinite' }}>...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div style={{
          padding: '15px',
          borderTop: '1px solid #333'
        }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder='Ask about CLAUDE.md, request updates, or get guidance...'
              disabled={isChatLoading}
              style={{
                flex: 1,
                minHeight: '60px',
                maxHeight: '120px',
                padding: '10px',
                backgroundColor: '#0f0f0f',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <button
              onClick={sendChatMessage}
              disabled={!currentMessage.trim() || isChatLoading}
              style={{
                padding: '10px 15px',
                backgroundColor: currentMessage.trim() && !isChatLoading ? '#00aa44' : '#333',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                cursor: currentMessage.trim() && !isChatLoading ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                alignSelf: 'flex-end'
              }}
            >
              📤
            </button>
          </div>
          <div style={{
            fontSize: '11px',
            color: '#666',
            marginTop: '5px'
          }}>
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
