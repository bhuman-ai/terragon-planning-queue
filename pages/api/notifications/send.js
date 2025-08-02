/**
 * Send notifications when autonomous tasks need user input
 * Supports multiple notification channels (webhook, email, SMS)
 */

const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, taskTitle, message, channels = ['webhook'], urgency = 'normal' } = req.body;

    if (!taskId || !message) {
      return res.status(400).json({ error: 'taskId and message are required' });
    }

    const results = [];

    // Send via webhook (default)
    if (channels.includes('webhook') && process.env.NOTIFICATION_WEBHOOK) {
      try {
        await axios.post(process.env.NOTIFICATION_WEBHOOK, {
          type: 'task_needs_input',
          task_id: taskId,
          task_title: taskTitle,
          message: message,
          urgency: urgency,
          timestamp: new Date().toISOString(),
          action_url: `${process.env.VERCEL_URL || 'http://localhost:3000'}/task/${taskId}/resume`
        });
        
        results.push({ channel: 'webhook', status: 'sent' });
      } catch (error) {
        results.push({ channel: 'webhook', status: 'failed', error: error.message });
      }
    }

    // Send via email (if configured)
    if (channels.includes('email') && process.env.EMAIL_API_KEY) {
      try {
        // Example using SendGrid or similar service
        await axios.post('https://api.sendgrid.v3/mail/send', {
          personalizations: [{
            to: [{ email: process.env.USER_EMAIL }],
            subject: `🤖 Task "${taskTitle}" needs your input`
          }],
          from: { email: process.env.FROM_EMAIL || 'noreply@terragon.ai' },
          content: [{
            type: 'text/html',
            value: `
              <h2>Autonomous Task Paused</h2>
              <p><strong>Task:</strong> ${taskTitle}</p>
              <p><strong>Reason:</strong> ${message}</p>
              <p><a href="${process.env.VERCEL_URL}/task/${taskId}/resume" style="background: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Resume Task</a></p>
              <p><small>Task ID: ${taskId}</small></p>
            `
          }]
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        results.push({ channel: 'email', status: 'sent' });
      } catch (error) {
        results.push({ channel: 'email', status: 'failed', error: error.message });
      }
    }

    // Send via SMS (if configured and urgent)
    if (channels.includes('sms') && urgency === 'urgent' && process.env.TWILIO_ACCOUNT_SID) {
      try {
        const twilioAuth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        
        await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, 
          new URLSearchParams({
            To: process.env.USER_PHONE,
            From: process.env.TWILIO_PHONE,
            Body: `🤖 Task "${taskTitle}" needs input: ${message.substring(0, 100)}... View: ${process.env.VERCEL_URL}/task/${taskId}`
          }), {
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        results.push({ channel: 'sms', status: 'sent' });
      } catch (error) {
        results.push({ channel: 'sms', status: 'failed', error: error.message });
      }
    }

    // Log notification for monitoring
    console.log(`📱 Notification sent for task ${taskId}:`, results);

    res.status(200).json({
      success: true,
      message: 'Notifications processed',
      taskId,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notifications',
      details: error.message
    });
  }
}