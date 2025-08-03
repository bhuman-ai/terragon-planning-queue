import { useState, useEffect, useRef } from 'react';

/**
 * MergeReviewView - Diff visualization and conflict resolution
 *
 * Features:
 * - Side-by-side diff visualization
 * - Intelligent conflict detection and resolution
 * - AI-powered merge suggestions
 * - Sacred document integrity validation
 * - Collaborative review workflow
 */
export default function MergeReviewView({
  sessionId,
  agentAuth,
  onMergeComplete,
  sourceDocument = '',
  targetDocument = '',
  mergeContext = {},
  readonly = false
}) {
  const [originalContent, setOriginalContent] = useState(sourceDocument);
  const [modifiedContent, setModifiedContent] = useState(targetDocument);
  const [mergedContent, setMergedContent] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [diffData, setDiffData] = useState([]);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [resolvedConflicts, setResolvedConflicts] = useState(new Set());
  const [mergeStrategy, setMergeStrategy] = useState('ai_assisted'); // 'manual', 'ai_assisted', 'auto'
  const [viewMode, setViewMode] = useState('side_by_side'); // 'side_by_side', 'unified', 'merged'
  const [validationStatus, setValidationStatus] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [chatMessages, setChatMessages] = useState([;
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to the Merge Review workspace! I can help you resolve conflicts, validate changes, and ensure document integrity. What would you like me to analyze?',
      timestamp: new Date().toISOString(),
      type: 'merge_review'
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [showConflictDetails, setShowConflictDetails] = useState(true);

  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Analyze documents when content changes
  useEffect(() => {
    if (originalContent && modifiedContent) {
      analyzeDifferences();
    }
  }, [originalContent, modifiedContent]);

  // Initialize merge analysis
  useEffect(() => {
    if (sourceDocument || targetDocument) {
      setOriginalContent(sourceDocument);
      setModifiedContent(targetDocument);
      setMergedContent(targetDocument); // Start with target as base
    }
  }, [sourceDocument, targetDocument]);

  const analyzeDifferences = async () => {
    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/collaboration/merge/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          originalContent,
          modifiedContent,
          context: mergeContext,
          strategy: mergeStrategy
        })
      });

      if (response.ok) {
        const data = await response.json();

        setDiffData(data.diff || []);
        setConflicts(data.conflicts || []);
        setAiSuggestions(data.suggestions || []);
        setValidationStatus(data.validation || {});
        setMergedContent(data.merged || modifiedContent);

        addSystemMessage(`Analysis complete: ${data.conflicts?.length || 0} conflicts found`);

        // Auto-resolve simple conflicts if AI-assisted mode
        if (mergeStrategy === 'ai_assisted' && data.autoResolutions) {
          applyAutoResolutions(data.autoResolutions);
        }
      }
    } catch (error) {
      console.error('Failed to analyze differences:', error);
      addSystemMessage(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyAutoResolutions = (resolutions) => {
    resolutions.forEach(resolution => {
      if (resolution.confidence > 0.8) { // High confidence auto-resolve
        resolveConflict(resolution.conflictId, resolution.resolution);
      }
    });
  };

  const resolveConflict = async (conflictId, resolution) => {
    try {
      const response = await fetch('/api/collaboration/merge/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          conflictId,
          resolution,
          mergedContent
        })
      });

      if (response.ok) {
        const data = await response.json();

        setMergedContent(data.updatedContent);
        setResolvedConflicts(prev => new Set([...prev, conflictId]));

        // Update conflicts list
        setConflicts(prev => prev.map(conflict =>
          conflict.id === conflictId
            ? { ...conflict, resolved: true, resolution }
            : conflict
        ));

        addSystemMessage(`Conflict resolved: ${resolution.type}`);
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      addSystemMessage(`Resolution failed: ${error.message}`);
    }
  };

  const validateMerge = async () => {
    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/collaboration/merge/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          mergedContent,
          originalContent,
          context: mergeContext
        })
      });

      if (response.ok) {
        const validation = await response.json();
        setValidationStatus(validation);

        const status = validation.valid ? 'passed' : 'failed';
        const issues = validation.issues?.length || 0;
        addSystemMessage(`Validation ${status}: ${issues} issues found`);

        return validation.valid;
      }
    } catch (error) {
      console.error('Validation failed:', error);
      addSystemMessage(`Validation error: ${error.message}`);
      return false;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const completeMerge = async () => {
    // Validate before completing
    const isValid = await validateMerge();
    if (!isValid && !confirm('Validation failed. Continue anyway?')) {
      return;
    }

    // Check for unresolved conflicts
    const unresolvedConflicts = conflicts.filter(c => !c.resolved);
    if (unresolvedConflicts.length > 0 && !confirm(`${unresolvedConflicts.length} conflicts remain unresolved. Continue anyway?`)) {
      return;
    }

    try {
      const response = await fetch('/api/collaboration/merge/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          mergedContent,
          resolutions: Array.from(resolvedConflicts),
          validation: validationStatus
        })
      });

      if (response.ok) {
        const result = await response.json();
        addSystemMessage('Merge completed successfully');
        onMergeComplete?.(result);
      }
    } catch (error) {
      console.error('Merge completion failed:', error);
      addSystemMessage(`Merge failed: ${error.message}`);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || isAnalyzing) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date().toISOString(),
      type: 'merge_review'
    };

    setChatMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/collaboration/merge/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          message: userMessage.content,
          context: {
            originalContent,
            modifiedContent,
            mergedContent,
            conflicts,
            diffData,
            validationStatus,
            selectedConflict
          },
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
          type: 'merge_review',
          suggestions: data.suggestions,
          actions: data.actions
        };

        setChatMessages(prev => [...prev, assistantMessage]);

        // Handle suggested actions
        if (data.actions) {
          data.actions.forEach(action => handleAssistantAction(action));
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
      setIsAnalyzing(false);
    }
  };

  const handleAssistantAction = async (action) => {
    switch (action.type) {
      case 'resolve_conflict':
        await resolveConflict(action.conflictId, action.resolution);
        break;
      case 'apply_suggestion':
        await applySuggestion(action.suggestion);
        break;
      case 'validate_merge':
        await validateMerge();
        break;
      case 'reanalyze':
        await analyzeDifferences();
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  const applySuggestion = async (suggestion) => {
    try {
      const response = await fetch('/api/collaboration/merge/apply-suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Auth': agentAuth
        },
        body: JSON.stringify({
          sessionId,
          suggestion,
          mergedContent
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMergedContent(data.updatedContent);
        addSystemMessage(`Applied suggestion: ${suggestion.description}`);
      }
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
      addSystemMessage(`Suggestion failed: ${error.message}`);
    }
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

  const renderDiffLine = (line, index) => {
    const getLineStyle = (type) => {
      switch (type) {
        case 'added':
          return { backgroundColor: '#004d00', borderLeft: '3px solid #00aa44' };
        case 'removed':
          return { backgroundColor: '#4d0000', borderLeft: '3px solid #aa4444' };
        case 'modified':
          return { backgroundColor: '#4d3300', borderLeft: '3px solid #ffaa66' };
        case 'conflict':
          return { backgroundColor: '#4d004d', borderLeft: '3px solid #aa44aa' };
        default:
          return {};
      }
    };

    return (
      <div key={index} style={{
        padding: '4px 10px',
        fontSize: '13px',
        fontFamily: 'Monaco, Menlo, monospace',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        gap: '10px',
        ...getLineStyle(line.type)
      }}>
        <span style={{ color: '#666', minWidth: '40px', flexShrink: 0 }}>
          {line.lineNumber}
        </span>
        <span style={{
          color: line.type === 'removed' ? '#ff6666' :
                line.type === 'added' ? '#00ff88' : '#e0e0e0',
          flex: 1
        }}>
          {line.content}
        </span>
      </div>
    );
  };

  const getValidationIcon = () => {
    if (isAnalyzing) return '⏳';
    if (validationStatus.valid) return '✅';
    if (validationStatus.valid === false) return '❌';
    return '❓';
  };

  const unresolvedConflicts = conflicts.filter(c => !c.resolved);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      backgroundColor: '#0a0a0a',
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Left Panel - Diff Visualization */}
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
              <h1 style={{ color: '#aa44aa', margin: 0, fontSize: '24px' }}>
                🔀 Merge Review
              </h1>
              <p style={{ color: '#888', margin: '5px 0 0 0', fontSize: '14px' }}>
                Diff Visualization • Conflict Resolution • Document Integrity
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{
                padding: '4px 8px',
                backgroundColor: validationStatus.valid ? '#004d00' : '#660000',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                {getValidationIcon()} Validation
              </div>

              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              >
                <option value='side_by_side'>📊 Side by Side</option>
                <option value='unified'>📝 Unified</option>
                <option value='merged'>🔀 Merged</option>
              </select>

              <select
                value={mergeStrategy}
                onChange={(e) => setMergeStrategy(e.target.value)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              >
                <option value='manual'>👤 Manual</option>
                <option value='ai_assisted'>🤖 AI Assisted</option>
                <option value='auto'>⚡ Auto</option>
              </select>

              <button
                onClick={validateMerge}
                disabled={isAnalyzing}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#0066cc',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  opacity: isAnalyzing ? 0.6 : 1
                }}
              >
                🔍 Validate
              </button>

              <button
                onClick={completeMerge}
                disabled={readonly || isAnalyzing}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#00aa44',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  opacity: readonly || isAnalyzing ? 0.6 : 1
                }}
              >
                ✅ Complete
              </button>
            </div>
          </div>

          {/* Status Summary */}
          <div style={{
            display: 'flex',
            gap: '20px',
            fontSize: '12px',
            color: '#666'
          }}>
            <span>Conflicts: {unresolvedConflicts.length}</span>
            <span>Resolved: {resolvedConflicts.size}</span>
            <span>Lines: {diffData.length}</span>
            <span>Strategy: {mergeStrategy}</span>
            {validationStatus.issues && (
              <span style={{ color: '#ff6666' }}>
                Issues: {validationStatus.issues.length}
              </span>
            )}
          </div>
        </div>

        {/* Diff Content */}
        <div style={{ flex: 1, display: 'flex' }}>
          {viewMode === 'side_by_side' && (
            <>
              {/* Original */}
              <div style={{
                flex: 1,
                borderRight: '1px solid #333',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  padding: '10px 15px',
                  backgroundColor: '#333',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#ccc'
                }}>
                  Original Document
                </div>
                <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#0f0f0f' }}>
                  <pre style={{
                    padding: '15px',
                    margin: 0,
                    fontSize: '13px',
                    fontFamily: 'Monaco, Menlo, monospace',
                    color: '#e0e0e0',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.5'
                  }}>
                    {originalContent}
                  </pre>
                </div>
              </div>

              {/* Modified */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  padding: '10px 15px',
                  backgroundColor: '#333',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#ccc'
                }}>
                  Modified Document
                </div>
                <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#0f0f0f' }}>
                  <pre style={{
                    padding: '15px',
                    margin: 0,
                    fontSize: '13px',
                    fontFamily: 'Monaco, Menlo, monospace',
                    color: '#e0e0e0',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.5'
                  }}>
                    {modifiedContent}
                  </pre>
                </div>
              </div>
            </>
          )}

          {viewMode === 'unified' && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                padding: '10px 15px',
                backgroundColor: '#333',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#ccc'
              }}>
                Unified Diff
              </div>
              <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#0f0f0f' }}>
                {diffData.length === 0 ? (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#666'
                  }}>
                    {isAnalyzing ? 'Analyzing differences...' : 'No differences found'}
                  </div>
                ) : (
                  diffData.map((line, index) => renderDiffLine(line, index))
                )}
              </div>
            </div>
          )}

          {viewMode === 'merged' && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                padding: '10px 15px',
                backgroundColor: '#333',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#ccc'
              }}>
                Merged Result
              </div>
              <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#0f0f0f' }}>
                <textarea
                  value={mergedContent}
                  onChange={(e) => setMergedContent(e.target.value)}
                  readOnly={readonly}
                  style={{
                    width: '100%',
                    height: '100%',
                    padding: '15px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#e0e0e0',
                    fontSize: '13px',
                    fontFamily: 'Monaco, Menlo, monospace',
                    resize: 'none',
                    outline: 'none',
                    lineHeight: '1.5'
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Conflicts & AI Chat */}
      <div style={{
        width: '400px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1a1a'
      }}>
        {/* Conflicts Panel */}
        <div style={{
          flex: showConflictDetails ? '1' : '0',
          borderBottom: '1px solid #333',
          maxHeight: showConflictDetails ? 'none' : '60px',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease'
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #333',
            cursor: 'pointer'
          }} onClick={() => setShowConflictDetails(!showConflictDetails)}>
            <h2 style={{ color: '#aa44aa', margin: 0, fontSize: '18px' }}>
              ⚔️ Conflicts ({unresolvedConflicts.length})
            </h2>
            <p style={{ color: '#888', fontSize: '12px', margin: '5px 0 0 0' }}>
              {showConflictDetails ? '▼' : '▶'} Click to {showConflictDetails ? 'collapse' : 'expand'}
            </p>
          </div>

          {showConflictDetails && (
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '15px'
            }}>
              {conflicts.length === 0 ? (
                <div style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>
                  {isAnalyzing ? 'Analyzing conflicts...' : 'No conflicts detected'}
                </div>
              ) : (
                conflicts.map(conflict => (
                  <div key={conflict.id} style={{
                    padding: '12px',
                    backgroundColor: conflict.resolved ? '#004d00' : '#0f0f0f',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    cursor: 'pointer'
                  }} onClick={() => setSelectedConflict(conflict)}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <h4 style={{
                        color: conflict.resolved ? '#00ff88' : '#ff6666',
                        margin: 0,
                        fontSize: '14px'
                      }}>
                        {conflict.type} Conflict
                      </h4>
                      <span style={{ fontSize: '11px', color: '#666' }}>
                        Line {conflict.line}
                      </span>
                    </div>

                    <p style={{
                      fontSize: '12px',
                      color: '#ccc',
                      margin: '0 0 8px 0',
                      lineHeight: '1.4'
                    }}>
                      {conflict.description}
                    </p>

                    {conflict.resolved && (
                      <div style={{ fontSize: '11px', color: '#888' }}>
                        ✅ Resolved: {conflict.resolution?.type}
                      </div>
                    )}

                    {!conflict.resolved && !readonly && (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resolveConflict(conflict.id, { type: 'accept_current', content: conflict.current });
                          }}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#00aa44',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '11px',
                            marginRight: '5px'
                          }}
                        >
                          Accept Current
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resolveConflict(conflict.id, { type: 'accept_incoming', content: conflict.incoming });
                          }}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#0066cc',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          Accept Incoming
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* AI Chat Panel */}
        <div style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #333'
          }}>
            <h2 style={{ color: '#aa44aa', margin: 0, fontSize: '18px' }}>
              🤖 Merge Assistant
            </h2>
            <p style={{ color: '#888', fontSize: '12px', margin: '5px 0 0 0' }}>
              Conflict resolution & validation guidance
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
                </div>
              </div>
            ))}

            {isAnalyzing && (
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
                  <span>Analyzing</span>
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
                placeholder='Ask about conflicts, request merge suggestions, or validate changes...'
                disabled={isAnalyzing}
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
                disabled={!currentMessage.trim() || isAnalyzing}
                style={{
                  padding: '10px 15px',
                  backgroundColor: currentMessage.trim() && !isAnalyzing ? '#00aa44' : '#333',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: currentMessage.trim() && !isAnalyzing ? 'pointer' : 'not-allowed',
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
