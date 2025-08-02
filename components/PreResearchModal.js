import { useState, useEffect } from 'react';

export default function PreResearchModal({ 
  show, 
  onClose, 
  task,
  onSubmit 
}) {
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preResearchQuestions, setPreResearchQuestions] = useState([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [error, setError] = useState(null);

  // Fetch dynamic questions when modal opens
  useEffect(() => {
    if (show && task) {
      fetchDynamicQuestions();
    }
  }, [show, task]);

  const fetchDynamicQuestions = async () => {
    setIsLoadingQuestions(true);
    setError(null);
    
    try {
      const response = await fetch('/api/meta-agent/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pre-research-requirements',
          message: `${task.title}: ${task.description}`,
          context: {
            priority: task.priority,
            taskId: task.id
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get questions: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.questions && data.questions.length > 0) {
        setPreResearchQuestions(data.questions);
      } else {
        throw new Error('No questions generated');
      }
    } catch (err) {
      console.error('Failed to fetch dynamic questions:', err);
      setError(err.message);
      // Fallback to basic questions if dynamic generation fails
      setPreResearchQuestions([
        {
          id: 'approach',
          question: `How would you like to approach "${task.title}"?`,
          type: 'text',
          multiline: true,
          placeholder: 'Describe your preferred approach or any specific requirements'
        }
      ]);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  if (!show || !task) return null;

  // Show loading state while fetching questions
  if (isLoadingQuestions) {
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
          padding: '40px',
          textAlign: 'center',
          color: '#e0e0e0'
        }}>
          <h3 style={{ color: '#00ff88' }}>🧠 Generating Dynamic Questions...</h3>
          <p style={{ color: '#888' }}>Analyzing your task to create relevant questions</p>
        </div>
      </div>
    );
  }

  const currentQuestion = preResearchQuestions[currentQuestionIndex];
  if (!currentQuestion) return null;
  
  const isLastQuestion = currentQuestionIndex === preResearchQuestions.length - 1;
  // Allow proceeding with "I don't know" or any answer
  const canProceed = answers[currentQuestion.id] !== undefined && answers[currentQuestion.id] !== '';

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
          justifyContent: 'flex-start',
          minHeight: '300px',
          overflowY: 'auto',
          maxHeight: 'calc(80vh - 250px)'
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
            {(currentQuestion.type === 'choice' || currentQuestion.type === 'single-choice') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentQuestion.options && currentQuestion.options.map(option => (
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
                {/* Always add "I don't know" option */}
                <button
                  onClick={() => handleAnswer(currentQuestion.id, "I don't know")}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: answers[currentQuestion.id] === "I don't know" ? '#ff880022' : '#0f0f0f',
                    border: answers[currentQuestion.id] === "I don't know" ? '2px solid #ff8800' : '1px solid #333',
                    borderRadius: '8px',
                    color: '#ff8800',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontStyle: 'italic',
                    transition: 'all 0.2s ease'
                  }}
                >
                  🤷 I don't know / Skip
                </button>
                
                {/* Custom answer option */}
                <div style={{ marginTop: '15px' }}>
                  <button
                    onClick={() => handleAnswer(currentQuestion.id, '__custom__')}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: answers[currentQuestion.id]?.startsWith('__custom__:') ? '#0088ff22' : '#0f0f0f',
                      border: answers[currentQuestion.id]?.startsWith('__custom__:') ? '2px solid #0088ff' : '1px solid #333',
                      borderRadius: '8px',
                      color: '#0088ff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      width: '100%'
                    }}
                  >
                    ✏️ Custom answer...
                  </button>
                  {answers[currentQuestion.id] === '__custom__' && (
                    <input
                      type="text"
                      placeholder="Type your custom answer..."
                      autoFocus
                      onChange={(e) => handleAnswer(currentQuestion.id, `__custom__:${e.target.value}`)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#0f0f0f',
                        border: '1px solid #0088ff',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '14px',
                        marginTop: '10px'
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {(currentQuestion.type === 'multiple' || currentQuestion.type === 'multi-choice') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentQuestion.options && currentQuestion.options.map(option => {
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
                {/* "I don't know" option for multi-choice */}
                <button
                  onClick={() => handleAnswer(currentQuestion.id, ["I don't know"])}
                  style={{
                    padding: '10px 14px',
                    backgroundColor: (answers[currentQuestion.id] || []).includes("I don't know") ? '#ff880022' : '#0f0f0f',
                    border: (answers[currentQuestion.id] || []).includes("I don't know") ? '2px solid #ff8800' : '1px solid #333',
                    borderRadius: '8px',
                    color: '#ff8800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '14px',
                    fontStyle: 'italic',
                    transition: 'all 0.2s ease',
                    marginTop: '10px'
                  }}
                >
                  🤷 I don't know / Not applicable
                </button>
              </div>
            )}

            {currentQuestion.type === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <textarea
                  value={answers[currentQuestion.id] === "I don't know" ? '' : (answers[currentQuestion.id] || '')}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                  placeholder={currentQuestion.placeholder || 'Type your answer here...'}
                  disabled={answers[currentQuestion.id] === "I don't know"}
                  style={{
                    width: '100%',
                    minHeight: currentQuestion.multiline !== false ? '100px' : '40px',
                    padding: '12px',
                    backgroundColor: answers[currentQuestion.id] === "I don't know" ? '#1a1a1a' : '#0f0f0f',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    color: answers[currentQuestion.id] === "I don't know" ? '#666' : '#fff',
                    fontSize: '14px',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    opacity: answers[currentQuestion.id] === "I don't know" ? 0.5 : 1
                  }}
                />
                <button
                  onClick={() => handleAnswer(currentQuestion.id, "I don't know")}
                  style={{
                    padding: '10px 14px',
                    backgroundColor: answers[currentQuestion.id] === "I don't know" ? '#ff880022' : '#0f0f0f',
                    border: answers[currentQuestion.id] === "I don't know" ? '2px solid #ff8800' : '1px solid #333',
                    borderRadius: '8px',
                    color: '#ff8800',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontStyle: 'italic',
                    transition: 'all 0.2s ease'
                  }}
                >
                  🤷 I don't know / Skip this question
                </button>
              </div>
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