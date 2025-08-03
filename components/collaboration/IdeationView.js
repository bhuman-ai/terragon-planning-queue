import { useState, useEffect, useRef } from 'react';

/**
 * IdeationView - Brainstorming interface with Claude-draft.md
 * 
 * Features:
 * - Real-time collaborative editing with Claude
 * - Claude-draft.md document workspace
 * - AI-powered ideation assistance
 * - Version history and branching
 * - Secure agent authentication
 */
export default function IdeationView({ 
  sessionId, 
  agentAuth, 
  onDocumentChange,
  initialDraft = '',
  readonly = false 
}) {
  const [draftContent, setDraftContent] = useState(initialDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to the ideation workspace! I\'m here to help you brainstorm and refine your CLAUDE.md document. What would you like to explore?',
      timestamp: new Date().toISOString(),
      type: 'ideation'
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [versionHistory, setVersionHistory] = useState([]);
  const [showVersions, setShowVersions] = useState(false);
  const [aiMode, setAiMode] = useState('collaborative'); // 'collaborative', 'research', 'critique'
  
  const textareaRef = useRef(null);
  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-save draft content
  useEffect(() => {
    if (draftContent !== initialDraft) {
      const saveTimer = setTimeout(saveDraft, 2000);
      return () => clearTimeout(saveTimer);
    }
  }, [draftContent]);

  // Handle text selection for contextual AI assistance
  const handleTextSelection = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.substring(start, end);
      
      setSelectedText(selected);
      setCursorPosition(start);
      
      // Generate contextual suggestions for selected text
      if (selected.length > 0) {
        generateContextualSuggestions(selected, start, end);
      }
    }
  };

  const generateContextualSuggestions = async (text, start, end) => {
    if (!text.trim()) return;

    try {
      const response = await fetch('/api/collaboration/ideation/suggestions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          selectedText: text,
          contextBefore: draftContent.substring(Math.max(0, start - 200), start),
          contextAfter: draftContent.substring(end, Math.min(draftContent.length, end + 200)),
          mode: aiMode
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    }
  };

  const saveDraft = async () => {
    try {
      const response = await fetch('/api/collaboration/ideation/save-draft', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          content: draftContent,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update version history
        setVersionHistory(prev => [
          {
            id: result.versionId,
            content: draftContent,
            timestamp: new Date().toISOString(),
            size: draftContent.length,
            changes: result.changes
          },
          ...prev.slice(0, 49) // Keep last 50 versions
        ]);

        onDocumentChange?.(draftContent);
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date().toISOString(),
      type: 'ideation'
    };

    setChatMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/collaboration/ideation/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          message: userMessage.content,
          draftContent,
          selectedText,
          aiMode,
          chatHistory: chatMessages.slice(-10)
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        const assistantMessage = {
          id: Date.now().toString() + '-ai',
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString(),
          type: 'ideation',
          suggestions: data.suggestions,
          proposedChanges: data.proposedChanges
        };

        setChatMessages(prev => [...prev, assistantMessage]);

        // Apply proposed changes if user wants auto-apply
        if (data.proposedChanges && aiMode === 'collaborative') {
          applyProposedChanges(data.proposedChanges);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
        type: 'error'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyProposedChanges = (changes) => {
    let newContent = draftContent;
    
    // Apply changes in reverse order to maintain positions
    changes.slice().reverse().forEach(change => {
      switch (change.type) {
        case 'insert':
          newContent = newContent.slice(0, change.position) + 
                     change.text + 
                     newContent.slice(change.position);
          break;
        case 'replace':
          newContent = newContent.slice(0, change.start) + 
                     change.text + 
                     newContent.slice(change.end);
          break;
        case 'delete':
          newContent = newContent.slice(0, change.start) + 
                     newContent.slice(change.end);
          break;
      }
    });

    setDraftContent(newContent);
  };

  const applySuggestion = (suggestion) => {
    if (suggestion.type === 'replace' && selectedText) {
      const newContent = draftContent.replace(selectedText, suggestion.text);
      setDraftContent(newContent);
      setSelectedText('');
      setSuggestions([]);
    } else if (suggestion.type === 'insert') {
      const before = draftContent.slice(0, cursorPosition);
      const after = draftContent.slice(cursorPosition);
      setDraftContent(before + suggestion.text + after);
    }
  };

  const restoreVersion = (version) => {
    setDraftContent(version.content);
    setShowVersions(false);
    addSystemMessage(`Restored version from ${new Date(version.timestamp).toLocaleString()}`);
  };

  const addSystemMessage = (content) => {
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'system',
      content,
      timestamp: new Date().toISOString(),
      type: 'system'
    }]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Left Panel - Draft Editor */}
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
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <div>
              <h1 style={{ color: '#66bbff', margin: 0, fontSize: '24px' }}>
                💡 Ideation Workspace
              </h1>
              <p style={{ color: '#888', margin: '5px 0 0 0', fontSize: '14px' }}>
                Claude-draft.md • Collaborative Brainstorming
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* AI Mode Selector */}
              <select
                value={aiMode}
                onChange={(e) => setAiMode(e.target.value)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              >
                <option value="collaborative">🤝 Collaborative</option>
                <option value="research">🔍 Research</option>
                <option value="critique">🎯 Critique</option>
              </select>

              <button
                onClick={() => setShowVersions(!showVersions)}
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
                📚 History ({versionHistory.length})
              </button>

              <button
                onClick={saveDraft}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#00aa44',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                💾 Save
              </button>
            </div>
          </div>

          {/* Document Stats */}
          <div style={{ 
            display: 'flex', 
            gap: '20px', 
            fontSize: '12px', 
            color: '#666'
          }}>
            <span>Words: {draftContent.split(/\s+/).filter(w => w.length > 0).length}</span>
            <span>Characters: {draftContent.length}</span>
            <span>Lines: {draftContent.split('\n').length}</span>
            {selectedText && (
              <span style={{ color: '#ffaa66' }}>Selected: {selectedText.length} chars</span>
            )}
          </div>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            onSelect={handleTextSelection}
            onMouseUp={handleTextSelection}
            onKeyUp={handleTextSelection}
            placeholder="Start brainstorming your CLAUDE.md document here..."
            readOnly={readonly}
            style={{
              flex: 1,
              padding: '20px',
              backgroundColor: '#0f0f0f',
              border: 'none',
              color: '#e0e0e0',
              fontSize: '14px',
              lineHeight: '1.6',
              fontFamily: 'Monaco, Menlo, monospace',
              resize: 'none',
              outline: 'none'
            }}
          />

          {/* Contextual Suggestions */}
          {suggestions.length > 0 && selectedText && (
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              width: '300px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '15px',
              zIndex: 10
            }}>
              <h4 style={{ color: '#ffaa66', margin: '0 0 10px 0', fontSize: '14px' }}>
                💡 AI Suggestions
              </h4>
              {suggestions.map((suggestion, index) => (
                <div key={index} style={{ marginBottom: '10px' }}>
                  <button
                    onClick={() => applySuggestion(suggestion)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      backgroundColor: '#333',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px',
                      textAlign: 'left'
                    }}
                  >
                    {suggestion.label}
                  </button>
                  <p style={{ 
                    fontSize: '11px', 
                    color: '#888', 
                    margin: '5px 0 0 0',
                    fontStyle: 'italic'
                  }}>
                    {suggestion.description}
                  </p>
                </div>
              ))}
              <button
                onClick={() => setSuggestions([])}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: '#666',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                ✕ Close
              </button>
            </div>
          )}

          {/* Version History Sidebar */}
          {showVersions && (
            <div style={{
              width: '300px',
              backgroundColor: '#1a1a1a',
              borderLeft: '1px solid #333',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                padding: '15px',
                borderBottom: '1px solid #333'
              }}>
                <h4 style={{ color: '#66bbff', margin: 0, fontSize: '14px' }}>
                  📚 Version History
                </h4>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
                {versionHistory.map((version, index) => (
                  <div key={version.id} style={{
                    padding: '10px',
                    backgroundColor: '#0f0f0f',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    cursor: 'pointer'
                  }} onClick={() => restoreVersion(version)}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#ffaa66',
                      marginBottom: '5px'
                    }}>
                      Version {versionHistory.length - index}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>
                      {new Date(version.timestamp).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>
                      {version.size} chars
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - AI Chat */}
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
            🤖 AI Ideation Assistant
          </h2>
          <p style={{ color: '#888', fontSize: '12px', margin: '5px 0 0 0' }}>
            Mode: {aiMode} • Select text for contextual help
          </p>
        </div>

        {/* Chat Messages */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '15px'
        }}>
          {chatMessages.map((message) => (
            <div key={message.id} style={{
              marginBottom: '15px',
              display: 'flex',
              flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
              gap: '10px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 
                  message.role === 'user' ? '#0066cc' : 
                  message.role === 'system' ? '#666' : '#00aa44',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0
              }}>
                {message.role === 'user' ? '👤' : 
                 message.role === 'system' ? '⚙️' : '🤖'}
              </div>

              <div style={{ flex: 1, maxWidth: '85%' }}>
                <div style={{
                  backgroundColor: 
                    message.role === 'user' ? '#003366' : 
                    message.role === 'system' ? '#333' : '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '14px',
                  lineHeight: '1.4'
                }}>
                  {message.content}
                </div>

                <div style={{
                  fontSize: '11px',
                  color: '#666',
                  marginTop: '4px',
                  textAlign: message.role === 'user' ? 'right' : 'left'
                }}>
                  {formatTimestamp(message.timestamp)}
                </div>

                {/* Quick Actions for AI suggestions */}
                {message.suggestions && message.suggestions.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    {message.suggestions.slice(0, 3).map((suggestion, idx) => (
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
          
          {isLoading && (
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
              placeholder="Describe your ideas, ask for feedback, or request suggestions..."
              disabled={isLoading}
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
              onClick={sendMessage}
              disabled={!currentMessage.trim() || isLoading}
              style={{
                padding: '10px 15px',
                backgroundColor: currentMessage.trim() && !isLoading ? '#00aa44' : '#333',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                cursor: currentMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
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

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}