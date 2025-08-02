/**
 * Dedicated WhatsApp notification endpoint for Meta-Agent
 * Sends WhatsApp messages to +1 9292762732 when user input is needed
 */

const axios = require('axios');

// Default user's WhatsApp number
const DEFAULT_WHATSAPP_NUMBER = '+19292762732';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      message, 
      taskId, 
      taskTitle, 
      urgency = 'normal',
      phoneNumber = DEFAULT_WHATSAPP_NUMBER 
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const results = [];
    let sent = false;

    // Format the WhatsApp message
    const whatsappMessage = `🤖 *Meta-Agent Alert*

${urgency === 'urgent' ? '🚨 *URGENT* 🚨\n' : ''}
*Task:* ${taskTitle || 'Autonomous Task'}
${taskId ? `*Task ID:* ${taskId}\n` : ''}
*Action Needed:* ${message}

*Resume at:* ${process.env.VERCEL_URL || 'https://terragon-vercel.bhuman.vercel.app'}/task/${taskId}/resume

Reply "HELP" for more info.`;

    // Method 1: Try WhatsApp Business API
    if (process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      try {
        const response = await axios.post(
          `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: 'whatsapp',
            to: phoneNumber.replace(/[^0-9]/g, ''), // Remove all non-numeric chars
            type: 'text',
            text: { body: whatsappMessage }
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        results.push({ 
          method: 'whatsapp-business-api', 
          status: 'sent',
          messageId: response.data.messages?.[0]?.id 
        });
        sent = true;
      } catch (error) {
        results.push({ 
          method: 'whatsapp-business-api', 
          status: 'failed', 
          error: error.response?.data || error.message 
        });
      }
    }

    // Method 2: Try Twilio WhatsApp
    if (!sent && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_WHATSAPP_NUMBER) {
      try {
        const twilioAuth = Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64');
        
        const response = await axios.post(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
          new URLSearchParams({
            To: `whatsapp:${phoneNumber}`,
            From: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            Body: whatsappMessage
          }),
          {
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );
        
        results.push({ 
          method: 'twilio-whatsapp', 
          status: 'sent',
          messageSid: response.data.sid 
        });
        sent = true;
      } catch (error) {
        results.push({ 
          method: 'twilio-whatsapp', 
          status: 'failed', 
          error: error.response?.data || error.message 
        });
      }
    }

    // Method 3: Try custom WhatsApp webhook
    if (!sent && process.env.WHATSAPP_WEBHOOK_URL) {
      try {
        const response = await axios.post(process.env.WHATSAPP_WEBHOOK_URL, {
          to: phoneNumber,
          message: whatsappMessage,
          taskId: taskId,
          urgency: urgency,
          timestamp: new Date().toISOString()
        });
        
        results.push({ 
          method: 'custom-webhook', 
          status: 'sent',
          response: response.data
        });
        sent = true;
      } catch (error) {
        results.push({ 
          method: 'custom-webhook', 
          status: 'failed', 
          error: error.message 
        });
      }
    }

    // Method 4: Try using MCP WhatsApp server if available
    if (!sent && process.env.MCP_WHATSAPP_ENABLED === 'true') {
      results.push({ 
        method: 'mcp-whatsapp', 
        status: 'unavailable', 
        note: 'MCP WhatsApp server integration pending' 
      });
    }

    // Log the notification attempt
    console.log(`📱 WhatsApp notification attempt for ${phoneNumber}:`, {
      taskId,
      sent,
      results,
      message: message.substring(0, 100) + '...'
    });

    res.status(200).json({
      success: sent,
      phoneNumber: phoneNumber,
      results: results,
      timestamp: new Date().toISOString(),
      message: sent ? 'WhatsApp notification sent successfully' : 'Failed to send WhatsApp notification'
    });

  } catch (error) {
    console.error('WhatsApp notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send WhatsApp notification',
      details: error.message
    });
  }
}