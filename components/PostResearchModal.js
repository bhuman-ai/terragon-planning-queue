import { useState } from 'react';

export default function PostResearchModal({ 
  show, 
  onClose, 
  requirements,
  onSubmit 
}) {
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!show || !requirements) return null;

  const { questions, research, context } = requirements;
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  
  const canProceed = answers[currentQuestion?.id] && 
    (currentQuestion?.type !== 'text' || answers[currentQuestion.id].trim());

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
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
        maxWidth: '700px',
        maxHeight: '90vh',
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
              color: '#00aaff', 
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              🧠 Post-Research Questions
            </h2>
            <div style={{ 
              fontSize: '14px', 
              color: '#888',
              marginTop: '5px' 
            }}>
              Step 2: Informed questions based on research findings
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

        {/* Research Summary */}
        {research && research.success && (
          <div style={{
            padding: '15px 20px',
            borderBottom: '1px solid #333',
            backgroundColor: '#0f0f0f'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#00aaff',
              marginBottom: '8px',
              fontWeight: 'bold'
            }}>
              🔍 RESEARCH INFORMED THESE QUESTIONS
            </div>
            <div style={{
              fontSize: '12px',
              color: '#ccc',
              lineHeight: '1.4',
              maxHeight: '60px',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {research.content.substring(0, 200)}...
            </div>
          </div>
        )}

        {/* Progress */}
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid #333',
          backgroundColor: '#0a0a0a'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <span style={{ fontSize: '14px', color: '#888' }}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span style={{ fontSize: '12px', color: '#00ff88' }}>
              📊 Context-Aware Questions
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
              width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
              height: '100%',
              backgroundColor: '#00aaff',
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
          minHeight: '300px',
          overflowY: 'auto'
        }}>
          {currentQuestion && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '10px'
                }}>
                  <span style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    backgroundColor: '#00aaff22',
                    color: '#00aaff',
                    borderRadius: '12px',
                    textTransform: 'uppercase',
                    fontWeight: 'bold'
                  }}>
                    {currentQuestion.category || 'technical'}
                  </span>
                </div>
                
                <h3 style={{
                  color: '#fff',
                  fontSize: '18px',
                  marginBottom: '10px',
                  lineHeight: '1.4'
                }}>
                  {currentQuestion.question}
                </h3>
                
                {currentQuestion.explanation && (
                  <p style={{
                    color: '#aaa',
                    fontSize: '14px',
                    margin: 0,
                    fontStyle: 'italic'
                  }}>
                    💡 {currentQuestion.explanation}
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '30px' }}>
                {currentQuestion.type === 'choice' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {currentQuestion.options.map(option => (
                      <button
                        key={option}
                        onClick={() => handleAnswer(currentQuestion.id, option)}
                        style={{
                          padding: '14px 18px',
                          backgroundColor: answers[currentQuestion.id] === option ? '#00aaff22' : '#0f0f0f',
                          border: answers[currentQuestion.id] === option ? '2px solid #00aaff' : '1px solid #333',
                          borderRadius: '8px',
                          color: '#fff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '14px',
                          transition: 'all 0.2s ease',
                          lineHeight: '1.4'
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
                            padding: '12px 16px',
                            backgroundColor: isSelected ? '#00aaff22' : '#0f0f0f',
                            border: isSelected ? '2px solid #00aaff' : '1px solid #333',
                            borderRadius: '6px',
                            color: '#fff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            lineHeight: '1.4'
                          }}
                        >
                          <span style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            backgroundColor: isSelected ? '#00aaff' : 'transparent',
                            border: '2px solid #00aaff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {isSelected && '✓'}
                          </span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === 'boolean' && (
                  <div style={{ display: 'flex', gap: '15px' }}>
                    {['Yes', 'No'].map(option => (
                      <button
                        key={option}
                        onClick={() => handleAnswer(currentQuestion.id, option === 'Yes')}
                        style={{
                          flex: 1,
                          padding: '14px',
                          backgroundColor: answers[currentQuestion.id] === (option === 'Yes') ? '#00aaff22' : '#0f0f0f',
                          border: answers[currentQuestion.id] === (option === 'Yes') ? '2px solid #00aaff' : '1px solid #333',
                          borderRadius: '8px',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '16px',
                          fontWeight: 'bold'
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'text' && (
                  <textarea
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                    placeholder={currentQuestion.placeholder || 'Enter your answer...'}
                    style={{
                      width: '100%',
                      minHeight: currentQuestion.multiline ? '120px' : '50px',
                      padding: '14px',
                      backgroundColor: '#0f0f0f',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '14px',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      lineHeight: '1.4'
                    }}
                  />
                )}
              </div>
            </>
          )}
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
                  backgroundColor: canProceed ? '#00aaff' : '#333',
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
                  padding: '12px 24px',
                  backgroundColor: canProceed && !isSubmitting ? '#00ff88' : '#333',
                  color: canProceed && !isSubmitting ? '#000' : '#666',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: canProceed && !isSubmitting ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {isSubmitting ? 'Creating Proposal...' : '📋 Create Task Proposal'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}