import { useState, useEffect } from 'react';

export default function ClaudeAutoUpdaterPanel() {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Load status on component mount
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/claude-md/auto-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to load auto-updater status:', error);
    }
  };

  const detectChanges = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/claude-md/auto-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'detect' })
      });

      if (response.ok) {
        const data = await response.json();
        setLastAction(data);
      }
    } catch (error) {
      console.error('Failed to detect changes:', error);
      setLastAction({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const executeUpdate = async (forceUpdate = false) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/claude-md/auto-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', forceUpdate })
      });

      if (response.ok) {
        const data = await response.json();
        setLastAction(data);
        await loadStatus(); // Refresh status
      }
    } catch (error) {
      console.error('Failed to execute update:', error);
      setLastAction({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const createBackup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/claude-md/auto-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup' })
      });

      if (response.ok) {
        const data = await response.json();
        setLastAction(data);
        await loadStatus(); // Refresh status
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      setLastAction({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!status) return '#666';
    if (!status.autoUpdaterEnabled) return '#ff4444';
    if (status.lastUpdate?.success) return '#00ff88';
    return '#ffaa00';
  };

  const getStatusText = () => {
    if (!status) return 'Loading...';
    if (!status.autoUpdaterEnabled) return 'Disabled (No API Key)';
    if (status.lastUpdate?.success) return 'Active & Healthy';
    return 'Active';
  };

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: expanded ? '20px' : '0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            boxShadow: `0 0 8px ${getStatusColor()}44`
          }} />
          <h3 style={{
            color: '#fff',
            margin: 0,
            fontSize: '18px'
          }}>
            🤖 CLAUDE.md Auto-Updater
          </h3>
          <span style={{
            color: '#888',
            fontSize: '14px',
            backgroundColor: '#0f0f0f',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            {getStatusText()}
          </span>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: '1px solid #555',
            borderRadius: '4px',
            color: '#ccc',
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {expanded ? '▼ Hide' : '▶ Show'}
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div>
          {/* Quick Info */}
          {status && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              <div style={{
                backgroundColor: '#0f0f0f',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #333'
              }}>
                <div style={{ color: '#888', marginBottom: '4px' }}>Next Check</div>
                <div style={{ color: '#fff' }}>
                  {status.nextScheduledCheck ?
                    new Date(status.nextScheduledCheck).toLocaleTimeString() :
                    'Unknown'
                  }
                </div>
              </div>

              <div style={{
                backgroundColor: '#0f0f0f',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #333'
              }}>
                <div style={{ color: '#888', marginBottom: '4px' }}>Backups</div>
                <div style={{ color: '#fff' }}>
                  {status.backupCount} stored
                </div>
              </div>

              <div style={{
                backgroundColor: '#0f0f0f',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #333'
              }}>
                <div style={{ color: '#888', marginBottom: '4px' }}>Last Update</div>
                <div style={{ color: '#fff' }}>
                  {status.lastUpdate ?
                    new Date(status.lastUpdate.timestamp).toLocaleDateString() :
                    'Never'
                  }
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={detectChanges}
              disabled={isLoading}
              style={{
                padding: '10px 16px',
                backgroundColor: '#0066cc',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              🔍 Detect Changes
            </button>

            <button
              onClick={() => executeUpdate(false)}
              disabled={isLoading}
              style={{
                padding: '10px 16px',
                backgroundColor: '#00aa44',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              🚀 Smart Update
            </button>

            <button
              onClick={() => executeUpdate(true)}
              disabled={isLoading}
              style={{
                padding: '10px 16px',
                backgroundColor: '#cc6600',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              ⚡ Force Update
            </button>

            <button
              onClick={createBackup}
              disabled={isLoading}
              style={{
                padding: '10px 16px',
                backgroundColor: '#666',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              💾 Create Backup
            </button>

            <button
              onClick={loadStatus}
              disabled={isLoading}
              style={{
                padding: '10px 16px',
                backgroundColor: '#333',
                border: '1px solid #555',
                borderRadius: '6px',
                color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              🔄 Refresh
            </button>
          </div>

          {/* Last Action Result */}
          {lastAction && (
            <div style={{
              backgroundColor: lastAction.error ? '#331111' : '#001122',
              border: `1px solid ${lastAction.error ? '#aa4444' : '#004488'}`,
              borderRadius: '6px',
              padding: '15px',
              marginBottom: '15px'
            }}>
              <h4 style={{
                color: lastAction.error ? '#ff6666' : '#66bbff',
                margin: '0 0 10px 0',
                fontSize: '16px'
              }}>
                {lastAction.error ? '❌ Error' : '✅ Result'}
              </h4>

              {lastAction.error ? (
                <div style={{ color: '#ffaaaa', fontSize: '14px' }}>
                  {lastAction.error}
                </div>
              ) : (
                <div>
                  <div style={{ color: '#fff', marginBottom: '10px', fontSize: '14px' }}>
                    {lastAction.message}
                  </div>

                  {lastAction.triggers && (
                    <div style={{ fontSize: '13px', color: '#ccc' }}>
                      <strong>Changes Detected:</strong> {lastAction.triggers.changeCount}
                      {lastAction.triggers.changes && lastAction.triggers.changes.length > 0 && (
                        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                          {lastAction.triggers.changes.slice(0, 5).map((change, idx) => (
                            <li key={idx} style={{ marginBottom: '4px' }}>
                              <span style={{
                                color: change.severity === 'HIGH' ? '#ff8888' :
                                  change.severity === 'MEDIUM' ? '#ffaa88' : '#88ff88'
                              }}>
                                {change.type}
                              </span>: {change.message}
                            </li>
                          ))}
                          {lastAction.triggers.changes.length > 5 && (
                            <li style={{ color: '#888', fontStyle: 'italic' }}>
                              ...and {lastAction.triggers.changes.length - 5} more
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}

                  {lastAction.updated && (
                    <div style={{
                      color: '#88ff88',
                      fontSize: '13px',
                      marginTop: '8px',
                      fontWeight: 'bold'
                    }}>
                      🎉 CLAUDE.md was successfully updated!
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Recent Updates */}
          {status?.updateHistory && status.updateHistory.length > 0 && (
            <div>
              <h4 style={{ color: '#fff', fontSize: '16px', marginBottom: '10px' }}>
                📜 Recent Updates
              </h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {status.updateHistory.slice(-5).reverse().map((update, idx) => (
                  <div key={idx} style={{
                    backgroundColor: '#0f0f0f',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    padding: '10px',
                    marginBottom: '8px',
                    fontSize: '13px'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        color: update.success ? '#88ff88' : '#ff8888',
                        fontWeight: 'bold'
                      }}>
                        {update.type || 'AUTO_UPDATE'}
                      </span>
                      <span style={{ color: '#888' }}>
                        {new Date(update.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {update.proposal?.updates && (
                      <div style={{ color: '#ccc' }}>
                        {update.proposal.updates.length} sections updated
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div style={{
            backgroundColor: '#0a0a0a',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '12px',
            color: '#888',
            marginTop: '15px'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <strong style={{ color: '#aaa' }}>🤖 Automated Updates:</strong> The system monitors project changes every 30 minutes and automatically updates CLAUDE.md when significant changes are detected.
            </div>
            <div>
              <strong style={{ color: '#aaa' }}>🎯 Smart Detection:</strong> Only updates when real changes are found (new dependencies, file structure changes, version updates, etc.).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
