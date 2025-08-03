import { useState, useEffect } from 'react';

export default function ClaudeMdVersionHistory({
  repository,
  show,
  onClose,
  onRestoreVersion
}) {
  const [versions, setVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [compareVersions, setCompareVersions] = useState({ a: null, b: null });

  useEffect(() => {
    if (show && repository) {
      fetchVersionHistory();
    }
  }, [show, repository]);

  const fetchVersionHistory = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/calibration/claude-md-versions?repo=${encodeURIComponent(repository)}`);

      if (!response.ok) throw new Error('Failed to fetch version history');

      const data = await response.json();
      setVersions(data.versions || []);

    } catch (error) {
      console.error('Failed to fetch version history:', error);
      alert('Failed to load version history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompareVersions = async () => {
    if (!compareVersions.a || !compareVersions.b) {
      alert('Please select two versions to compare');
      return;
    }

    setIsComparing(true);

    try {
      const response = await fetch('/api/calibration/claude-md-versions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: repository,
          versionA: compareVersions.a,
          versionB: compareVersions.b
        })
      });

      if (!response.ok) throw new Error('Failed to compare versions');

      const data = await response.json();
      setComparisonData(data);

    } catch (error) {
      console.error('Failed to compare versions:', error);
      alert('Failed to compare versions');
    } finally {
      setIsComparing(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'HIGH': return '#00ff88';
      case 'MEDIUM': return '#ffaa00';
      case 'LOW': return '#ff6b6b';
      default: return '#888';
    }
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '12px',
        width: '90vw',
        maxWidth: '1000px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        color: '#e0e0e0'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{
              color: '#fff',
              margin: 0,
              fontSize: '20px',
              fontWeight: 'bold'
            }}>
              📜 CLAUDE.md Version History
            </h2>
            <div style={{
              fontSize: '14px',
              color: '#888',
              marginTop: '5px'
            }}>
              Repository: {repository}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '5px'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px'
        }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: '#888' }}>Loading version history...</p>
            </div>
          ) : versions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: '#888' }}>No versions found for this repository</p>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Versions are created automatically when CLAUDE.md is updated
              </p>
            </div>
          ) : (
            <div>
              {/* Version Comparison Section */}
              <div style={{
                backgroundColor: '#0f0f0f',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px'
              }}>
                <h3 style={{ color: '#fff', marginBottom: '15px', fontSize: '16px' }}>
                  🔍 Compare Versions
                </h3>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                  <div>
                    <label style={{ color: '#ccc', fontSize: '14px', marginBottom: '5px', display: 'block' }}>
                      Version A:
                    </label>
                    <select
                      value={compareVersions.a || ''}
                      onChange={(e) => setCompareVersions(prev => ({ ...prev, a: e.target.value }))}
                      style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        color: '#fff',
                        padding: '8px',
                        fontSize: '13px'
                      }}
                    >
                      <option value=''>Select version...</option>
                      {versions.map(version => (
                        <option key={version.id} value={version.id}>
                          {version.id} - {formatTimestamp(version.timestamp)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ color: '#ccc', fontSize: '14px', marginBottom: '5px', display: 'block' }}>
                      Version B:
                    </label>
                    <select
                      value={compareVersions.b || ''}
                      onChange={(e) => setCompareVersions(prev => ({ ...prev, b: e.target.value }))}
                      style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        color: '#fff',
                        padding: '8px',
                        fontSize: '13px'
                      }}
                    >
                      <option value=''>Select version...</option>
                      {versions.map(version => (
                        <option key={version.id} value={version.id}>
                          {version.id} - {formatTimestamp(version.timestamp)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleCompareVersions}
                    disabled={!compareVersions.a || !compareVersions.b || isComparing}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: compareVersions.a && compareVersions.b ? '#00ff88' : '#333',
                      border: 'none',
                      borderRadius: '4px',
                      color: compareVersions.a && compareVersions.b ? '#000' : '#666',
                      cursor: compareVersions.a && compareVersions.b ? 'pointer' : 'not-allowed',
                      fontSize: '13px',
                      marginTop: '20px'
                    }}
                  >
                    {isComparing ? 'Comparing...' : 'Compare'}
                  </button>
                </div>

                {/* Comparison Results */}
                {comparisonData && (
                  <div style={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    padding: '15px',
                    marginTop: '15px'
                  }}>
                    <h4 style={{ color: '#fff', marginBottom: '10px' }}>Comparison Results</h4>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                      <div>
                        <h5 style={{ color: '#00ff88', margin: '0 0 5px 0' }}>
                          {comparisonData.versionA.id}
                        </h5>
                        <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>
                          {formatTimestamp(comparisonData.versionA.timestamp)}
                        </p>
                      </div>

                      <div>
                        <h5 style={{ color: '#ff6b6b', margin: '0 0 5px 0' }}>
                          {comparisonData.versionB.id}
                        </h5>
                        <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>
                          {formatTimestamp(comparisonData.versionB.timestamp)}
                        </p>
                      </div>
                    </div>

                    <div style={{ fontSize: '13px' }}>
                      <p style={{ color: '#ccc', margin: '5px 0' }}>
                        📊 Changes: {comparisonData.differences.summary.addedLines} additions, {' '}
                        {comparisonData.differences.summary.deletedLines} deletions, {' '}
                        {comparisonData.differences.summary.modifiedLines} modifications
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Version List */}
              <div>
                <h3 style={{ color: '#fff', marginBottom: '15px', fontSize: '16px' }}>
                  📚 Version History ({versions.length} versions)
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {versions.map((version, index) => (
                    <div
                      key={version.id}
                      style={{
                        backgroundColor: index === 0 ? '#0a2a0a' : '#0f0f0f',
                        border: index === 0 ? '1px solid #00ff88' : '1px solid #333',
                        borderRadius: '8px',
                        padding: '15px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={() => setSelectedVersion(selectedVersion === version.id ? null : version.id)}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '10px'
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h4 style={{
                              color: index === 0 ? '#00ff88' : '#fff',
                              margin: 0,
                              fontSize: '14px'
                            }}>
                              {version.id} {index === 0 && '(CURRENT)'}
                            </h4>
                            <span style={{
                              padding: '2px 6px',
                              backgroundColor: '#333',
                              borderRadius: '3px',
                              fontSize: '11px',
                              color: '#ccc'
                            }}>
                              {version.contentHash}
                            </span>
                          </div>

                          <p style={{
                            color: '#888',
                            fontSize: '12px',
                            margin: '5px 0'
                          }}>
                            {formatTimestamp(version.timestamp)} by {version.author}
                          </p>

                          <p style={{
                            color: '#ccc',
                            fontSize: '13px',
                            margin: '5px 0'
                          }}>
                            {version.changelog}
                          </p>
                        </div>

                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '5px',
                          alignItems: 'flex-end'
                        }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#888'
                          }}>
                            {version.stats.contentLength} chars, {version.stats.sectionsCount} sections
                          </div>

                          {index > 0 && onRestoreVersion && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRestoreVersion(version);
                              }}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#333',
                                border: 'none',
                                borderRadius: '3px',
                                color: '#ccc',
                                cursor: 'pointer',
                                fontSize: '11px'
                              }}
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {selectedVersion === version.id && (
                        <div style={{
                          borderTop: '1px solid #333',
                          paddingTop: '15px',
                          marginTop: '15px'
                        }}>
                          {/* Confidence Levels */}
                          <div style={{ marginBottom: '15px' }}>
                            <h5 style={{ color: '#ccc', fontSize: '13px', marginBottom: '8px' }}>
                              Confidence Levels:
                            </h5>
                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                              {Object.entries(version.confidence || {}).map(([key, value]) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <span style={{ color: '#888', fontSize: '12px' }}>{key}:</span>
                                  <span style={{
                                    color: getConfidenceColor(value),
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                  }}>
                                    {value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Changes Detected */}
                          {version.changesDetected && version.changesDetected.length > 0 && (
                            <div style={{ marginBottom: '15px' }}>
                              <h5 style={{ color: '#ccc', fontSize: '13px', marginBottom: '8px' }}>
                                Changes Detected:
                              </h5>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {version.changesDetected.slice(0, 3).map((change, i) => (
                                  <div key={i} style={{
                                    padding: '5px 8px',
                                    backgroundColor: '#1a1a1a',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                  }}>
                                    <span style={{ color: '#00aaff' }}>{change.type}:</span>
                                    <span style={{ color: '#ccc', marginLeft: '8px' }}>
                                      {change.description}
                                    </span>
                                  </div>
                                ))}
                                {version.changesDetected.length > 3 && (
                                  <span style={{ color: '#666', fontSize: '11px' }}>
                                    +{version.changesDetected.length - 3} more changes
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Review Notes */}
                          {version.reviewNotes && (
                            <div>
                              <h5 style={{ color: '#ccc', fontSize: '13px', marginBottom: '8px' }}>
                                Review Notes:
                              </h5>
                              <p style={{
                                color: '#aaa',
                                fontSize: '12px',
                                backgroundColor: '#1a1a1a',
                                padding: '8px',
                                borderRadius: '4px',
                                margin: 0
                              }}>
                                {version.reviewNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #333',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#333',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
