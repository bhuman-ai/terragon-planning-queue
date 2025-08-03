import { useState, useEffect } from 'react';

export default function ProjectInterviewModal({
  show,
  onClose,
  onComplete
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(true);
  const [interviewQuestions, setInterviewQuestions] = useState([]);

  useEffect(() => {
    if (show) {
      generateInterviewQuestions();
    }
  }, [show]);

  const generateInterviewQuestions = async () => {
    setIsGeneratingQuestions(true);

    try {
      // Generate dynamic questions using AI
      const response = await fetch('/api/meta-agent/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'project-interview',
          phase: Object.keys(answers).length > 0 ? 'detailed' : 'initial',
          existingAnswers: answers
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate questions: ${response.status}`);
      }

      const data = await response.json();

      // API returns { success, action, result: { questions, phase } }
      if (data.success && data.result?.questions && data.result.questions.length > 0) {
        setInterviewQuestions(data.result.questions);
      } else {
        throw new Error('No questions generated');
      }
    } catch (error) {
      console.error('Failed to generate dynamic project questions:', error);

      // Handle error properly - investigate root cause
      alert('Failed to generate interview questions. Please check your AI configuration and try again.');
      setIsGeneratingQuestions(false);
      onClose(); // Close modal on error
      return; // Exit early
    }

    setIsGeneratingQuestions(false);
  };

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (currentStep < interviewQuestions.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    // Create project structure based on interview
    const projectData = {
      name: answers.project_type,
      goal: answers.main_goal,
      tech: answers.tech_preferences,
      timeline: answers.timeline,
      experience: answers.experience_level,
      ...answers
    };

    await onComplete(projectData);
  };

  if (!show) return null;

  if (isGeneratingQuestions) {
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
        zIndex: 2000
      }}>
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '2px solid #00ff88',
          borderRadius: '10px',
          padding: '40px',
          textAlign: 'center',
          color: '#e0e0e0'
        }}>
          <h2 style={{ color: '#00ff88', marginBottom: '20px' }}>🎯 Let's understand your project...</h2>
          <p style={{ color: '#888' }}>Preparing interview questions</p>
        </div>
      </div>
    );
  }

  const currentQuestion = interviewQuestions[currentStep];
  if (!currentQuestion) return null;

  const progress = ((currentStep + 1) / interviewQuestions.length) * 100;
  const canProceed = answers[currentQuestion.id] || !currentQuestion.required;

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
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '2px solid #00ff88',
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
              fontSize: '20px',
              fontWeight: 'bold'
            }}>
              🎯 Project Setup Interview
            </h2>
            <div style={{
              fontSize: '14px',
              color: '#888',
              marginTop: '5px'
            }}>
              Let's understand what you're building
            </div>
          </div>
        </div>

        {/* Progress */}
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid #333'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '10px',
            fontSize: '13px',
            color: '#aaa'
          }}>
            <span>Question {currentStep + 1} of {interviewQuestions.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div style={{
            height: '4px',
            backgroundColor: '#333',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#00ff88',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* Question */}
        <div style={{
          flex: 1,
          padding: '30px',
          overflowY: 'auto'
        }}>
          <h3 style={{
            color: '#fff',
            fontSize: '20px',
            marginBottom: '20px',
            lineHeight: '1.4'
          }}>
            {currentQuestion.question}
          </h3>

          {/* Text input */}
          {currentQuestion.type === 'text' && (
            <textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
              placeholder={currentQuestion.placeholder}
              style={{
                width: '100%',
                minHeight: '100px',
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

          {/* Single choice */}
          {currentQuestion.type === 'single-choice' && (
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

          {/* Multi choice */}
          {currentQuestion.type === 'multi-choice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentQuestion.options.map(option => {
                const currentAnswers = answers[currentQuestion.id] || [];
                const isSelected = currentAnswers.includes(option);

                return (
                  <button
                    key={option}
                    onClick={() => {
                      const newAnswers = isSelected
                        ? currentAnswers.filter(a => a !== option);
                        : [...currentAnswers, option];
                      handleAnswer(currentQuestion.id, newAnswers);
                    }}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: isSelected ? '#00ff8822' : '#0f0f0f',
                      border: isSelected ? '2px solid #00ff88' : '1px solid #333',
                      borderRadius: '8px',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '14px',
                      transition: 'all 0.2s ease'
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
        </div>

        {/* Actions */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            style={{
              padding: '10px 20px',
              backgroundColor: '#333',
              border: 'none',
              borderRadius: '5px',
              color: '#fff',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              opacity: currentStep === 0 ? 0.5 : 1,
              fontSize: '14px'
            }}
          >
            ← Previous
          </button>

          {currentStep < interviewQuestions.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed}
              style={{
                padding: '10px 30px',
                backgroundColor: canProceed ? '#00ff88' : '#333',
                border: 'none',
                borderRadius: '5px',
                color: canProceed ? '#000' : '#666',
                cursor: canProceed ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={!canProceed}
              style={{
                padding: '10px 30px',
                backgroundColor: canProceed ? '#00ff88' : '#333',
                border: 'none',
                borderRadius: '5px',
                color: canProceed ? '#000' : '#666',
                cursor: canProceed ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              🚀 Create Project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
