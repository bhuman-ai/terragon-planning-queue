import { useState } from 'react';

export default function PreResearchModal({ 
  show, 
  onClose, 
  task,
  onSubmit 
}) {
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Basic pre-research questions that don't require codebase knowledge
  const preResearchQuestions = [
    {
      id: 'scope',
      question: 'What is the primary scope of this task?',
      type: 'choice',
      options: [
        'New feature implementation',
        'Bug fix or improvement',
        'Refactoring existing code',
        'Integration with external service',
        'Performance optimization',
        'Security enhancement'
      ],
      explanation: 'Understanding the general nature helps focus the research'
    },
    {
      id: 'priority',
      question: 'What is the urgency level for this task?',
      type: 'choice',
      options: [
        'Critical - needs immediate attention',
        'High - should be done this week',
        'Medium - can be scheduled flexibly',
        'Low - nice to have when time permits'
      ],
      explanation: 'Helps prioritize research depth and implementation approach'
    },
    {
      id: 'user_impact',
      question: 'Who will be primarily affected by this change?',
      type: 'multiple',
      options: [
        'End users directly',
        'Development team',
        'System administrators',
        'Third-party integrations',
        'Performance/scalability',
        'Security/compliance'
      ],
      explanation: 'Understanding impact helps guide research focus'
    },
    {
      id: 'constraints',
      question: 'Are there any specific constraints or requirements?',
      type: 'text',
      multiline: true,
      placeholder: 'e.g., must use specific libraries, backwards compatibility needs, performance targets, etc.',
      explanation: 'Constraints will influence the research and solution approach'
    },
    {
      id: 'context',
      question: 'Any additional context or background information?',
      type: 'text',
      multiline: true,
      placeholder: 'e.g., related to other features, business requirements, technical debt, etc.',
      explanation: 'Extra context helps with more targeted research'
    }
  ];

  if (!show || !task) return null;

  const currentQuestion = preResearchQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === preResearchQuestions.length - 1;
  const canProceed = answers[currentQuestion.id] && 
    (currentQuestion.type !== 'text' || answers[currentQuestion.id].trim());

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < preResearchQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(answers);
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
        maxWidth: '600px',
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
              color: '#00ff88', 
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              📝 Pre-Research Questions
            </h2>
            <div style={{ 
              fontSize: '14px', 
              color: '#888',
              marginTop: '5px' 
            }}>
              Step 1: Basic clarification before research
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

        {/* Progress */}
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid #333',
          backgroundColor: '#0f0f0f'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <span style={{ fontSize: '14px', color: '#888' }}>
              Question {currentQuestionIndex + 1} of {preResearchQuestions.length}
            </span>
            <span style={{ fontSize: '12px', color: '#00aaff' }}>
              🎯 {task.title}
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '4px',
            backgroundColor: '#333',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${((currentQuestionIndex + 1) / preResearchQuestions.length) * 100}%`,
              height: '100%',
              backgroundColor: '#00ff88',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* Question Content */}
        <div style={{
          flex: 1,
          padding: '30px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: '300px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              color: '#fff',
              fontSize: '20px',
              marginBottom: '10px',
              lineHeight: '1.4'
            }}>
              {currentQuestion.question}
            </h3>
            <p style={{
              color: '#aaa',
              fontSize: '14px',
              margin: 0
            }}>
              {currentQuestion.explanation}
            </p>
          </div>

          <div style={{ marginBottom: '30px' }}>
            {currentQuestion.type === 'choice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentQuestion.options.map(option => (
                  <button
                    key={option}
                    onClick={() => handleAnswer(currentQuestion.id, option)}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: answers[currentQuestion.id] === option ? '#00ff8822' : '#0f0f0f',
                      border: answers[currentQuestion.id] === option ? '2px solid #00ff88' : '1px solid #333',
                      borderRadius: '8px',
                      color: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === 'multiple' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentQuestion.options.map(option => {
                  const currentAnswers = answers[currentQuestion.id] || [];
                  const isSelected = currentAnswers.includes(option);
                  
                  return (
                    <button
                      key={option}
                      onClick={() => {
                        const newAnswers = isSelected
                          ? currentAnswers.filter(a => a !== option)
                          : [...currentAnswers, option];
                        handleAnswer(currentQuestion.id, newAnswers);
                      }}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: isSelected ? '#00ff8822' : '#0f0f0f',
                        border: isSelected ? '2px solid #00ff88' : '1px solid #333',
                        borderRadius: '6px',
                        color: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <span style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '3px',
                        backgroundColor: isSelected ? '#00ff88' : 'transparent',
                        border: '2px solid #00ff88',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px'
                      }}>
                        {isSelected && '✓'}
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'text' && (
              <textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                placeholder={currentQuestion.placeholder}
                style={{
                  width: '100%',
                  minHeight: currentQuestion.multiline ? '100px' : '40px',
                  padding: '12px',
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: '1px solid #555',
              borderRadius: '5px',
              color: currentQuestionIndex === 0 ? '#555' : '#ccc',
              cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            ← Previous
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            {!isLastQuestion ? (
              <button
                onClick={handleNext}
                disabled={!canProceed}
                style={{
                  padding: '10px 20px',
                  backgroundColor: canProceed ? '#00ff88' : '#333',
                  color: canProceed ? '#000' : '#666',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: canProceed ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed || isSubmitting}
                style={{
                  padding: '10px 20px',
                  backgroundColor: canProceed && !isSubmitting ? '#00ff88' : '#333',
                  color: canProceed && !isSubmitting ? '#000' : '#666',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: canProceed && !isSubmitting ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {isSubmitting ? 'Starting Research...' : '🔍 Start Research & Analysis'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}