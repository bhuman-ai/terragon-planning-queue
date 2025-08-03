import { useState, useEffect, useRef } from 'react';

export default function DynamicCalibrationWizard({ show, onClose, onComplete, githubRepo }) {
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [scanResults, setScanResults] = useState({});
  const [questionCount, setQuestionCount] = useState(0);
  const [canGenerateClaudeMd, setCanGenerateClaudeMd] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Start the calibration when wizard opens
  useEffect(() => {
    if (show && !currentQuestion) {
      startCalibration();
    }
  }, [show]);

  const startCalibration = async () => {
    try {
      // First, scan the repository
      setIsLoadingQuestion(true);
      const scanResponse = await fetch('/api/calibration/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: githubRepo })
      });

      if (scanResponse.ok) {
        const scanData = await scanResponse.json();
        setScanResults(scanData);
      }

      // Generate the first question
      await generateNextQuestion();
    } catch (error) {
      console.error('Failed to start calibration:', error);
    }
  };

  const generateNextQuestion = async () => {
    try {
      setIsLoadingQuestion(true);
      
      const response = await fetch('/api/calibration/dynamic-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: githubRepo,
          conversationHistory,
          scanResults,
          questionCount
        })
      });

      if (response.ok) {
        const questionData = await response.json();
        setCurrentQuestion(questionData.question);
        setCanGenerateClaudeMd(questionData.canGenerateClaudeMd);
        setCurrentAnswer('');
      } else {
        throw new Error('Failed to generate question');
      }
    } catch (error) {
      console.error('Error generating question:', error);
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const handleAnswerSubmit = async () => {
    if (!currentAnswer.trim()) return;

    // Add to conversation history
    const newExchange = {
      question: currentQuestion,
      answer: currentAnswer,
      timestamp: new Date().toISOString()
    };

    const newHistory = [...conversationHistory, newExchange];
    setConversationHistory(newHistory);
    setQuestionCount(questionCount + 1);

    // Generate next question
    await generateNextQuestion();
  };

  const handleGenerateClaudeMd = async () => {
    try {
      const response = await fetch('/api/calibration/generate-claude-md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: githubRepo,
          conversationHistory,
          scanResults
        })
      });

      if (response.ok) {
        const result = await response.json();
        onComplete(result);
      } else {
        throw new Error('Failed to generate CLAUDE.md');
      }
    } catch (error) {
      console.error('Error generating CLAUDE.md:', error);
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result.split(',')[1];
        
        const response = await fetch('/api/voice/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioData: base64Audio })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.transcript) {
            setCurrentAnswer(result.transcript);
          }
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error transcribing audio:', error);
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
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#1a1a1a',
        padding: '30px',
        borderRadius: '15px',
        border: '1px solid #333',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        color: '#e0e0e0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#00ff88', margin: 0 }}>
            🔥 Dynamic Repository Calibration
          </h2>
          <button onClick={onClose} style={{ background: '#ff3300', padding: '5px 10px' }}>
            ✕
          </button>
        </div>

        {/* Progress */}
        <div style={{
          background: '#0a0a0a',
          padding: '15px',
          borderRadius: '10px',
          marginBottom: '20px',
          border: '1px solid #333'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Questions Answered: {questionCount}</span>
            <span>Files Scanned: {scanResults.fileCount || 0}</span>
            {canGenerateClaudeMd && (
              <button 
                onClick={handleGenerateClaudeMd}
                style={{ 
                  background: '#00ff88', 
                  color: '#000', 
                  padding: '8px 16px',
                  fontWeight: 'bold'
                }}
              >
                🔥 Generate CLAUDE.md
              </button>
            )}
          </div>
        </div>

        {/* Conversation History */}
        {conversationHistory.length > 0 && (
          <div style={{
            background: '#0a0a0a',
            padding: '15px',
            borderRadius: '10px',
            marginBottom: '20px',
            border: '1px solid #333',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            <h4 style={{ color: '#00aaff', marginBottom: '10px' }}>Conversation History</h4>
            {conversationHistory.slice(-3).map((exchange, idx) => (
              <div key={idx} style={{ marginBottom: '10px', fontSize: '12px' }}>
                <div style={{ color: '#00ff88' }}>Q: {exchange.question?.text}</div>
                <div style={{ color: '#ccc', marginLeft: '10px' }}>A: {exchange.answer}</div>
              </div>
            ))}
          </div>
        )}

        {/* Current Question */}
        {isLoadingQuestion ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ color: '#00aaff' }}>🤔 Thinking of next question...</div>
          </div>
        ) : currentQuestion ? (
          <div style={{
            background: '#0a0a0a',
            padding: '20px',
            borderRadius: '10px',
            border: '1px solid #333',
            marginBottom: '20px'
          }}>
            <h3 style={{ color: '#00ff88', marginBottom: '15px' }}>
              Question {questionCount + 1}
            </h3>
            <p style={{ marginBottom: '15px', lineHeight: 1.6 }}>
              {currentQuestion.text}
            </p>
            
            {currentQuestion.type === 'choice' && currentQuestion.options ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentQuestion.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentAnswer(option)}
                    style={{
                      background: currentAnswer === option ? '#00ff88' : '#333',
                      color: currentAnswer === option ? '#000' : '#fff',
                      padding: '10px',
                      textAlign: 'left',
                      border: 'none',
                      borderRadius: '5px'
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <textarea
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    rows={3}
                    style={{
                      flex: 1,
                      background: '#333',
                      border: '1px solid #555',
                      borderRadius: '5px',
                      padding: '10px',
                      color: '#fff',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {/* Voice Input Button */}
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      style={{
                        background: isRecording ? '#ff3300' : '#0088ff',
                        color: '#fff',
                        padding: '10px',
                        borderRadius: '5px',
                        border: 'none',
                        fontSize: '16px',
                        cursor: 'pointer',
                        minWidth: '60px'
                      }}
                      title={isRecording ? 'Stop recording' : 'Start voice input'}
                    >
                      {isRecording ? '🛑' : '🎤'}
                    </button>
                  </div>
                </div>
                {isRecording && (
                  <div style={{ 
                    color: '#ff3300', 
                    fontSize: '12px', 
                    textAlign: 'center',
                    marginBottom: '10px'
                  }}>
                    🔴 Recording... Click 🛑 to stop
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
              <button
                onClick={handleAnswerSubmit}
                disabled={!currentAnswer.trim()}
                style={{
                  background: currentAnswer.trim() ? '#00ff88' : '#333',
                  color: currentAnswer.trim() ? '#000' : '#666',
                  padding: '10px 20px',
                  fontWeight: 'bold'
                }}
              >
                Next Question →
              </button>
              
              {canGenerateClaudeMd && (
                <div style={{ color: '#00aaff', fontSize: '12px', alignSelf: 'center' }}>
                  💡 You can generate CLAUDE.md now or answer more questions for better results
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div style={{ 
          textAlign: 'center', 
          fontSize: '12px', 
          color: '#666',
          marginTop: '20px' 
        }}>
          <p>🎤 Use voice input for natural conversation</p>
          <p>Questions adapt based on your answers</p>
        </div>
      </div>
    </div>
  );
}