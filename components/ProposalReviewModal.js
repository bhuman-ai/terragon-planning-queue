import { useState } from 'react';

export default function ProposalReviewModal({
  isOpen,
  onClose,
  proposal,
  onApprove,
  onReject,
  onModify
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [modifications, setModifications] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !proposal) return null;

  const {
    taskTitle,
    requirements,
    research,
    decomposition,
    totalTime,
    criticalPath
  } = proposal;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove(proposal);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await onReject(proposal);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModify = async () => {
    if (!modifications.trim()) return;

    setIsSubmitting(true);
    try {
      await onModify(proposal, modifications);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '10px',
        width: '90vw',
        maxWidth: '1000px',
        height: '85vh',
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
          <h2 style={{
            color: '#00ff88',
            margin: 0,
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            📋 Meta-Agent Proposal Review
          </h2>
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

        {/* Task Title */}
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid #333',
          backgroundColor: '#0f0f0f'
        }}>
          <h3 style={{
            color: '#00aaff',
            margin: 0,
            fontSize: '18px'
          }}>
            🎯 {taskTitle}
          </h3>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #333',
          backgroundColor: '#0f0f0f'
        }}>
          {[
            { id: 'overview', label: '📊 Overview', icon: '📊' },
            { id: 'research', label: '🔍 Research', icon: '🔍' },
            { id: 'tasks', label: '📝 Micro-Tasks', icon: '📝' },
            { id: 'timeline', label: '⏱️ Timeline', icon: '⏱️' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                background: activeTab === tab.id ? '#00ff8822' : 'transparent',
                border: 'none',
                color: activeTab === tab.id ? '#00ff88' : '#888',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid #00ff88' : 'none',
                fontSize: '14px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto'
        }}>
          {activeTab === 'overview' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#00ff88', marginBottom: '10px' }}>
                  📋 Requirements Summary
                </h4>
                {requirements && requirements.questions ? (
                  requirements.questions.map((req, idx) => (
                    <div key={idx} style={{
                      padding: '10px',
                      backgroundColor: '#0f0f0f',
                      borderRadius: '5px',
                      marginBottom: '8px',
                      borderLeft: '3px solid #00ff88'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                        {req.question}
                      </div>
                      <div style={{ color: '#ccc' }}>
                        {req.answer || 'No answer provided'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#666' }}>No requirements gathered</div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#00ff88', marginBottom: '10px' }}>
                  📊 Project Statistics
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '15px'
                }}>
                  <div style={{
                    padding: '15px',
                    backgroundColor: '#0f0f0f',
                    borderRadius: '5px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', color: '#00ff88' }}>
                      {decomposition?.microTasks?.length || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      Micro-Tasks
                    </div>
                  </div>
                  <div style={{
                    padding: '15px',
                    backgroundColor: '#0f0f0f',
                    borderRadius: '5px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', color: '#00aaff' }}>
                      {totalTime || 0}min
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      Total Time
                    </div>
                  </div>
                  <div style={{
                    padding: '15px',
                    backgroundColor: '#0f0f0f',
                    borderRadius: '5px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '24px', color: '#ffaa00' }}>
                      {criticalPath || 0}min
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      Critical Path
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'research' && (
            <div>
              <h4 style={{ color: '#00ff88', marginBottom: '15px' }}>
                🔍 Research Findings
              </h4>
              {research && research.success ? (
                <div style={{
                  padding: '15px',
                  backgroundColor: '#0f0f0f',
                  borderRadius: '5px',
                  borderLeft: '3px solid #00aaff'
                }}>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                    {research.content}
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#666'
                }}>
                  No research data available
                </div>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div>
              <h4 style={{ color: '#00ff88', marginBottom: '15px' }}>
                📝 Micro-Task Breakdown
              </h4>
              {decomposition && decomposition.microTasks ? (
                decomposition.microTasks.map((task, idx) => (
                  <div key={idx} style={{
                    padding: '15px',
                    backgroundColor: '#0f0f0f',
                    borderRadius: '5px',
                    marginBottom: '10px',
                    borderLeft: `3px solid ${
                      task.type === 'setup' ? '#ffaa00' :
                        task.type === 'implementation' ? '#00ff88' :
                          task.type === 'testing' ? '#00aaff' :
                            task.type === 'integration' ? '#ff8800' :
                              task.type === 'deployment' ? '#ff4444' : '#888'
                    }`
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                        {task.order || task.id}. {task.title}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <span style={{
                          fontSize: '12px',
                          padding: '2px 8px',
                          backgroundColor: '#333',
                          borderRadius: '3px',
                          textTransform: 'uppercase'
                        }}>
                          {task.type}
                        </span>
                        <span style={{
                          fontSize: '12px',
                          color: '#00aaff'
                        }}>
                          {task.duration}min
                        </span>
                      </div>
                    </div>

                    {task.dependencies && task.dependencies.length > 0 && (
                      <div style={{ marginBottom: '8px', fontSize: '14px' }}>
                        <span style={{ color: '#ffaa00' }}>Depends on: </span>
                        {task.dependencies.join(', ')}
                      </div>
                    )}

                    <div style={{
                      marginBottom: '8px',
                      fontSize: '14px',
                      color: '#ccc'
                    }}>
                      <span style={{ color: '#888' }}>Success Criteria: </span>
                      {task.successCriteria}
                    </div>

                    {task.technicalDetails && (
                      <div style={{
                        fontSize: '12px',
                        color: '#888',
                        fontStyle: 'italic'
                      }}>
                        Technical: {task.technicalDetails}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#666'
                }}>
                  No task breakdown available
                </div>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div>
              <h4 style={{ color: '#00ff88', marginBottom: '15px' }}>
                ⏱️ Execution Timeline
              </h4>
              <div style={{
                display: 'grid',
                gap: '10px'
              }}>
                {decomposition && decomposition.microTasks ? (
                  decomposition.microTasks.map((task, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px',
                      backgroundColor: '#0f0f0f',
                      borderRadius: '5px'
                    }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        backgroundColor: '#00ff88',
                        color: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        marginRight: '15px'
                      }}>
                        {task.order || task.id}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold' }}>
                          {task.title}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          {task.duration} minutes • {task.type}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#666', textAlign: 'center' }}>
                    No timeline data available
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #333',
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleReject}
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ff3300',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1
            }}
          >
            ❌ Reject
          </button>

          <button
            onClick={() => {
              const mod = prompt('What modifications would you like to make?');
              if (mod) {
                setModifications(mod);
                handleModify();
              }
            }}
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ffaa00',
              color: '#000',
              border: 'none',
              borderRadius: '5px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1
            }}
          >
            ✏️ Request Changes
          </button>

          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              backgroundColor: '#00ff88',
              color: '#000',
              border: 'none',
              borderRadius: '5px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              fontWeight: 'bold'
            }}
          >
            ✅ Approve & Execute
          </button>
        </div>
      </div>
    </div>
  );
}
