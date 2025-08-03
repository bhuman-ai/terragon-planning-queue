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

    // Input validation
    if (!taskId || !message) {
      return res.status(400).json({ error: 'taskId and message are required' });
    }

    // Validate taskId format
    if (typeof taskId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(taskId)) {
      return res.status(400).json({ error: 'Invalid taskId format' });
    }

    // Validate and sanitize message
    if (typeof message !== 'string' || message.length > 1000) {
      return res.status(400).json({ error: 'Message must be a string under 1000 characters' });
    }

    // Validate taskTitle if provided
    if (taskTitle && (typeof taskTitle !== 'string' || taskTitle.length > 200)) {
      return res.status(400).json({ error: 'Task title must be a string under 200 characters' });
    }

    // Validate channels array
    if (!Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ error: 'Channels must be a non-empty array' });
    }

    const validChannels = ['webhook', 'whatsapp', 'discord', 'sms', 'email'];
    if (!channels.every(ch => validChannels.includes(ch))) {
      return res.status(400).json({ error: 'Invalid channel specified' });
    }

    // Validate urgency
    if (!['low', 'normal', 'high', 'critical'].includes(urgency)) {
      return res.status(400).json({ error: 'Invalid urgency level' });
    }

    const results = [];

    // Send via WhatsApp (highest priority for user input)
    if (channels.includes('whatsapp') || channels.includes('all')) {
      try {
        // Option 1: WhatsApp Business API (if configured)
        if (process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_USER_NUMBER) {
          await axios.post(
            `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
              messaging_product: 'whatsapp',
              to: process.env.WHATSAPP_USER_NUMBER,
              type: 'template',
              template: {
                name: 'task_needs_input',
                language: { code: 'en' },
                components: [{
                  type: 'body',
                  parameters: [
                    { type: 'text', text: taskTitle || 'Task' },
                    { type: 'text', text: message }
                  ]
                }]
              }
            },
            {
              headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }
          );
          results.push({ channel: 'whatsapp', status: 'sent', method: 'business-api' });
        }
        // Option 2: WhatsApp webhook service (simpler setup)
        else if (process.env.WHATSAPP_WEBHOOK_URL && process.env.WHATSAPP_USER_NUMBER) {
          await axios.post(process.env.WHATSAPP_WEBHOOK_URL, {
            to: process.env.WHATSAPP_USER_NUMBER,
            message: `🤖 *Meta-Agent Alert*\n\n*Task:* ${taskTitle}\n*Needs Input:* ${message}\n\n*Resume at:* ${process.env.VERCEL_URL}/task/${taskId}/resume`,
            taskId: taskId,
            urgency: urgency
          });
          results.push({ channel: 'whatsapp', status: 'sent', method: 'webhook' });
        }
        // Option 3: Use Twilio WhatsApp if configured
        else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_WHATSAPP_NUMBER && process.env.WHATSAPP_USER_NUMBER) {
          const twilioAuth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');

          await axios.post(
            `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
            new URLSearchParams({
              To: `whatsapp:${process.env.WHATSAPP_USER_NUMBER}`,
              From: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
              Body: `🤖 *Meta-Agent Alert*\n\n*Task:* ${taskTitle}\n*Needs Input:* ${message}\n\nResume at: ${process.env.VERCEL_URL}/task/${taskId}/resume`
            }),
            {
              headers: {
                'Authorization': `Basic ${twilioAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            }
          );
          results.push({ channel: 'whatsapp', status: 'sent', method: 'twilio' });
        }
        else {
          results.push({ channel: 'whatsapp', status: 'skipped', reason: 'No WhatsApp configuration found' });
        }
      } catch (error) {
        results.push({ channel: 'whatsapp', status: 'failed', error: error.message });
      }
    }

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
            subject: `🤖 Task '${taskTitle}' needs your input`
          }],
          from: { email: process.env.FROM_EMAIL || 'noreply@terragon.ai' },
          content: [{
            type: 'text/html',
            value: `
              <h2>Autonomous Task Paused</h2>
              <p><strong>Task:</strong> ${taskTitle}</p>
              <p><strong>Reason:</strong> ${message}</p>
              <p><a href='${process.env.VERCEL_URL}/task/${taskId}/resume' style='background: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>Resume Task</a></p>
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
            Body: `🤖 Task '${taskTitle}' needs input: ${message.substring(0, 100)}... View: ${process.env.VERCEL_URL}/task/${taskId}`
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
