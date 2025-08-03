/**
 * Voice Transcription API using Deepgram
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.DEEPGRAM_API_KEY) {
      return res.status(500).json({ error: 'Deepgram API key not configured' });
    }

    const { audioData } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');

    // Call Deepgram API
    const response = await fetch('https://api.deepgram.com/v1/listen', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/webm', // WebM format from MediaRecorder
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram API error:', response.status, errorText);
      throw new Error(`Deepgram API error: ${response.status}`);
    }

    const transcriptionResult = await response.json();
    
    // Extract the transcribed text
    const transcript = transcriptionResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = transcriptionResult.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

    res.status(200).json({
      transcript,
      confidence,
      success: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Voice transcription error:', error);
    res.status(500).json({
      error: 'Transcription failed',
      details: error.message,
      success: false
    });
  }
}

// Configure body parser for audio data
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Allow larger audio files
    },
  },
};