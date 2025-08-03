import { useState, useEffect } from 'react';

export default function UserSettingsModal({ show, onClose, onSave }) {
  const [settings, setSettings] = useState({
    technicalKnowledge: 'intermediate',
    experience: 'intermediate',
    questioningStyle: 'balanced',
    projectFamiliarity: 'new',
    decisionSpeed: 'balanced',
    communicationStyle: 'technical'
  });

  // Load settings from localStorage
  useEffect(() => {
    if (show) {
      const savedSettings = localStorage.getItem('meta-agent-user-settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    }
  }, [show]);

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('meta-agent-user-settings', JSON.stringify(settings));

    // Notify parent component
    onSave(settings);
    onClose();
  };

  const handleReset = () => {
    const defaultSettings = {
      technicalKnowledge: 'intermediate',
      experience: 'intermediate',
      questioningStyle: 'balanced',
      projectFamiliarity: 'new',
      decisionSpeed: 'balanced',
      communicationStyle: 'technical'
    };
    setSettings(defaultSettings);
  };

  if (!show) return null;

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
        borderRadius: '12px',
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
              color: '#fff',
              margin: 0,
              fontSize: '20px',
              fontWeight: 'bold'
            }}>
              ⚙️ Meta-Agent Settings
            </h2>
            <div style={{
              fontSize: '14px',
              color: '#888',
              marginTop: '5px'
            }}>
              Customize how Meta-Agent generates questions for you
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

            {/* Technical Knowledge Level */}
            <div>
              <label style={{
                color: '#fff',
                fontSize: '16px',
                fontWeight: 'bold',
                display: 'block',
                marginBottom: '8px'
              }}>
                🧠 Technical Knowledge Level
              </label>
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '12px' }}>
                How would you rate your overall technical expertise?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { value: 'beginner', label: 'Beginner', desc: 'New to programming, need basic explanations' },
                  { value: 'intermediate', label: 'Intermediate', desc: 'Comfortable with code, understand most concepts' },
                  { value: 'advanced', label: 'Advanced', desc: 'Experienced developer, focus on architecture' },
                  { value: 'expert', label: 'Expert', desc: 'Senior level, skip basic questions entirely' }
                ].map(option => (
                  <label key={option.value} style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '10px',
                    backgroundColor: settings.technicalKnowledge === option.value ? '#00ff8820' : '#0f0f0f',
                    border: settings.technicalKnowledge === option.value ? '1px solid #00ff88' : '1px solid #333',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type='radio'
                      name='technicalKnowledge'
                      value={option.value}
                      checked={settings.technicalKnowledge === option.value}
                      onChange={(e) => setSettings(prev => ({ ...prev, technicalKnowledge: e.target.value }))}
                      style={{ marginRight: '10px' }}
                    />
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold' }}>{option.label}</div>
                      <div style={{ color: '#aaa', fontSize: '12px' }}>{option.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Project Experience */}
            <div>
              <label style={{
                color: '#fff',
                fontSize: '16px',
                fontWeight: 'bold',
                display: 'block',
                marginBottom: '8px'
              }}>
                📁 Project Experience
              </label>
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '12px' }}>
                How familiar are you with projects of this type/scale?
              </p>
              <select
                value={settings.experience}
                onChange={(e) => setSettings(prev => ({ ...prev, experience: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              >
                <option value='first-time'>First time with this type of project</option>
                <option value='some'>Some experience with similar projects</option>
                <option value='intermediate'>Regular experience with these projects</option>
                <option value='expert'>Deep expertise in this domain</option>
              </select>
            </div>

            {/* Questioning Style */}
            <div>
              <label style={{
                color: '#fff',
                fontSize: '16px',
                fontWeight: 'bold',
                display: 'block',
                marginBottom: '8px'
              }}>
                💬 Questioning Style Preference
              </label>
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '12px' }}>
                How do you prefer to be asked questions?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { value: 'guided', label: '🎯 Guided', desc: 'Multiple choice, guided options' },
                  { value: 'open', label: '✏️ Open-ended', desc: 'Free-form text responses' },
                  { value: 'balanced', label: '⚖️ Balanced', desc: 'Mix of both styles' },
                  { value: 'minimal', label: '⚡ Minimal', desc: 'Ask as few questions as possible' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSettings(prev => ({ ...prev, questioningStyle: option.value }))}
                    style={{
                      padding: '12px',
                      backgroundColor: settings.questioningStyle === option.value ? '#00ff8820' : '#0f0f0f',
                      border: settings.questioningStyle === option.value ? '1px solid #00ff88' : '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{option.label}</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Communication Style */}
            <div>
              <label style={{
                color: '#fff',
                fontSize: '16px',
                fontWeight: 'bold',
                display: 'block',
                marginBottom: '8px'
              }}>
                🗣️ Communication Style
              </label>
              <select
                value={settings.communicationStyle}
                onChange={(e) => setSettings(prev => ({ ...prev, communicationStyle: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              >
                <option value='casual'>Casual - everyday language</option>
                <option value='technical'>Technical - use proper terminology</option>
                <option value='business'>Business - focus on outcomes</option>
                <option value='academic'>Academic - detailed and precise</option>
              </select>
            </div>

            {/* Decision Speed */}
            <div>
              <label style={{
                color: '#fff',
                fontSize: '16px',
                fontWeight: 'bold',
                display: 'block',
                marginBottom: '8px'
              }}>
                ⚡ Decision Making Speed
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[
                  { value: 'thorough', label: 'Thorough', desc: 'Ask detailed questions' },
                  { value: 'balanced', label: 'Balanced', desc: 'Standard questioning' },
                  { value: 'quick', label: 'Quick', desc: 'Minimal questions, smart defaults' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSettings(prev => ({ ...prev, decisionSpeed: option.value }))}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: settings.decisionSpeed === option.value ? '#00ff8820' : '#0f0f0f',
                      border: settings.decisionSpeed === option.value ? '1px solid #00ff88' : '1px solid #333',
                      borderRadius: '6px',
                      color: '#fff',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{option.label}</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={handleReset}
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
            Reset to Defaults
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                backgroundColor: '#555',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              style={{
                padding: '10px 20px',
                backgroundColor: '#00ff88',
                border: 'none',
                borderRadius: '6px',
                color: '#000',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Save Settings
            </button>
          </div>
        </div>

        {/* Info Footer */}
        <div style={{
          padding: '15px 20px',
          backgroundColor: '#0a0a0a',
          borderTop: '1px solid #333',
          borderRadius: '0 0 12px 12px',
          fontSize: '12px',
          color: '#666'
        }}>
          💡 These settings help Meta-Agent tailor questions to your expertise level and working style.
          Your preferences are saved locally and used for all future question generation.
        </div>
      </div>
    </div>
  );
}
