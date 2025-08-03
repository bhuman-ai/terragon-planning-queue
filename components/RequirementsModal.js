import { useState, useEffect } from 'react';

export default function RequirementsModal({
  show,
  onClose,
  requirements,
  onSubmit
}) {
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showResearch, setShowResearch] = useState(false);

  useEffect(() => {
    // Reset when new requirements come in
    if (requirements && requirements.questions) {
      setAnswers({});
      setCurrentQuestionIndex(0);
      setShowResearch(false);
    }
  }, [requirements]);

  if (!show || !requirements) return null;

  const { questions = [], research } = requirements;
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  const handleAnswer = (answer) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));

    // Only auto-advance for non-text questions
    if (currentQuestion.type !== 'text' && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
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

  const handleSubmit = () => {
    onSubmit(answers);
    onClose();
  };

  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const hasAnswer = answers[currentQuestion?.id] !== undefined;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '10px',
        padding: '30px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ color: '#00ff88', margin: 0 }}>
            🧠 Meta-Agent Requirements Gathering
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              fontSize: '24px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>

        {/* Context Analysis */}
        {requirements.reasoning && (
          <div style={{
            marginBottom: '15px',
            padding: '15px',
            background: '#2a2a2a',
            borderRadius: '5px',
            border: '1px solid #00ff88'
          }}>
            <div style={{
              color: '#00ff88',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🧠 Context Analysis
            </div>
            <p style={{
              color: '#ccc',
              fontSize: '13px',
              lineHeight: '1.5',
              fontStyle: 'italic'
            }}>
              {requirements.reasoning}
            </p>
          </div>
        )}

        {/* Research Toggle */}
        {research && research.success && (
          <div style={{
            marginBottom: '15px',
            padding: '10px',
            background: '#2a2a2a',
            borderRadius: '5px',
            border: '1px solid #444'
          }}>
            <button
              onClick={() => setShowResearch(!showResearch)}
              style={{
                background: 'none',
                border: 'none',
                color: '#00ff88',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>{showResearch ? '▼' : '▶'}</span>
              🔍 Research Insights Available
            </button>

            {showResearch && (
              <div style={{
                marginTop: '10px',
                padding: '10px',
                background: '#1a1a1a',
                borderRadius: '5px',
                fontSize: '13px',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                <p style={{ color: '#888', marginBottom: '10px' }}>
                  Meta-Agent researched best practices for your request:
                </p>
                <pre style={{ whiteSpace: 'pre-wrap', color: '#ccc' }}>
                  {research.content || 'No specific insights available'}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Progress Bar */}
        <div style={{
          background: '#333',
          height: '4px',
          borderRadius: '2px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: '#00ff88',
            height: '100%',
            width: `${progress}%`,
            borderRadius: '2px',
            transition: 'width 0.3s ease'
          }} />
        </div>

        {/* Question Number */}
        <p style={{ color: '#666', marginBottom: '10px' }}>
          Question {currentQuestionIndex + 1} of {questions.length}
        </p>

        {/* Current Question */}
        {currentQuestion && (
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{
              fontSize: '18px',
              marginBottom: '15px',
              color: '#fff'
            }}>
              {currentQuestion.question}
            </h3>

            {currentQuestion.explanation && (
              <div style={{
                background: '#333',
                padding: '10px',
                borderRadius: '5px',
                marginBottom: '15px',
                border: '1px solid #555'
              }}>
                <div style={{
                  color: '#ffaa00',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  marginBottom: '5px'
                }}>
                  💡 Why we're asking this:
                </div>
                <p style={{
                  color: '#ccc',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  margin: 0
                }}>
                  {currentQuestion.explanation}
                </p>
              </div>
            )}

            {/* Answer Options */}
            {currentQuestion.type === 'choice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentQuestion.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(option)}
                    style={{
                      padding: '12px 20px',
                      background: answers[currentQuestion.id] === option ? '#00ff88' : '#2a2a2a',
                      color: answers[currentQuestion.id] === option ? '#000' : '#fff',
                      border: '1px solid #444',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.type === 'multiple' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentQuestion.options.map((option, idx) => {
                  const currentAnswers = answers[currentQuestion.id] || [];
                  const isSelected = currentAnswers.includes(option);

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (isSelected) {
                          handleAnswer(currentAnswers.filter(a => a !== option));
                        } else {
                          handleAnswer([...currentAnswers, option]);
                        }
                      }}
                      style={{
                        padding: '12px 20px',
                        background: isSelected ? '#00ff88' : '#2a2a2a',
                        color: isSelected ? '#000' : '#fff',
                        border: '1px solid #444',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isSelected ? '✓ ' : ''}{option}
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'boolean' && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleAnswer(true)}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: answers[currentQuestion.id] === true ? '#00ff88' : '#2a2a2a',
                    color: answers[currentQuestion.id] === true ? '#000' : '#fff',
                    border: '1px solid #444',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Yes
                </button>
                <button
                  onClick={() => handleAnswer(false)}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: answers[currentQuestion.id] === false ? '#00ff88' : '#2a2a2a',
                    color: answers[currentQuestion.id] === false ? '#000' : '#fff',
                    border: '1px solid #444',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  No
                </button>
              </div>
            )}

            {currentQuestion.type === 'text' && (
              <div>
                <textarea
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !currentQuestion.multiline) {
                      e.preventDefault();
                      handleNext();
                    }
                  }}
                  placeholder={currentQuestion.placeholder || 'Type your answer here...'}
                  rows={currentQuestion.multiline ? 4 : 1}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '5px',
                    color: '#fff',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
                <div style={{
                  fontSize: '12px',
                  color: '#666',
                  marginTop: '5px',
                  textAlign: 'right'
                }}>
                  {currentQuestion.multiline ? 'Shift+Enter for new line' : 'Press Enter to continue'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '30px'
        }}>
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            style={{
              padding: '10px 20px',
              background: '#333',
              color: currentQuestionIndex === 0 ? '#666' : '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            {!isLastQuestion && (
              <button
                onClick={handleNext}
                disabled={!hasAnswer}
                style={{
                  padding: '10px 20px',
                  background: hasAnswer ? '#00ff88' : '#333',
                  color: hasAnswer ? '#000' : '#666',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: hasAnswer ? 'pointer' : 'not-allowed'
                }}
              >
                Next
              </button>
            )}

            {isLastQuestion && (
              <button
                onClick={handleSubmit}
                disabled={!hasAnswer}
                style={{
                  padding: '10px 30px',
                  background: hasAnswer ? '#00ff88' : '#333',
                  color: hasAnswer ? '#000' : '#666',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: hasAnswer ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold'
                }}
              >
                Submit & Continue
              </button>
            )}
          </div>
        </div>

        {/* Skip Option */}
        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid #333'
        }}>
          <button
            onClick={() => {
              onSubmit({});
              onClose();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Skip requirements gathering (use defaults)
          </button>
        </div>
      </div>
    </div>
  );
}
