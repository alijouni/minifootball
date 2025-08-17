// services/telegramService.js

const axios = require('axios'); // Changed from 'node-fetch'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_TELEGRAM_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID;
const MANAGER_TELEGRAM_CHAT_ID = process.env.MANAGER_TELEGRAM_CHAT_ID;
const OWNER_TELEGRAM_CHAT_ID = process.env.OWNER_TELEGRAM_CHAT_ID;

/**
 * Sends a message via Telegram Bot API using Axios.
 * @param {string} chatId - The chat ID of the recipient.
 * @param {string} messageText - The text message to send.
 * @returns {Promise<object>} - A promise that resolves to the Telegram API response.
 */
async function sendTelegramMessage(chatId, messageText) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('Telegram Bot Token is not set. Cannot send Telegram message.');
        return { success: false, error: 'Telegram Bot configuration missing.' };
    }
    if (!chatId || !messageText) {
        console.warn('Attempted to send Telegram message with missing chat ID or message text.');
        return { success: false, error: 'Recipient or message text missing.' };
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const data = new URLSearchParams({ // Use URLSearchParams for x-www-form-urlencoded
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML' // Optional: Allows basic HTML formatting
    });

    try {
        console.log(`Attempting to send Telegram message to chat ID: ${chatId}`);
        const response = await axios.post(url, data.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.data.ok) { // Axios wraps the response in .data
            console.log(`Telegram message sent successfully to ${chatId}.`);
            return { success: true, result: response.data.result };
        } else {
            console.error(`Failed to send Telegram message to ${chatId}:`, response.data.description);
            return { success: false, error: response.data.description, errorCode: response.data.error_code };
        }
    } catch (error) {
        // Axios errors have a 'response' property for HTTP errors
        if (error.response) {
            console.error(`Telegram API error for ${chatId} (Status ${error.response.status}):`, error.response.data.description);
            return { success: false, error: error.response.data.description, errorCode: error.response.data.error_code };
        } else {
            console.error(`Network or unexpected error sending Telegram message to ${chatId}:`, error.message);
            return { success: false, error: error.message };
        }
    }
}

// ... rest of your telegramService.js file (notifyAdminAndManagerTelegram function remains the same)
async function notifyAdminAndManagerTelegram(bookingDetails) {
    const message = `<b>⚽ حجز ملعب جديد!</b>\n\n` +
                    `<b>الاسم:</b> ${bookingDetails.name}\n` +
                    `<b>الهاتف:</b> ${bookingDetails.phone}\n` +
                    `<b>التاريخ:</b> ${bookingDetails.date}\n` +
                    `<b>الوقت:</b> ${bookingDetails.start_time} - ${bookingDetails.end_time}\n\n` +
                    `يرجى المراجعة والتأكيد في لوحة الإدارة.`;

    // Ensure recipient numbers are in E.164 format (e.g., '+96176123456')
    // and have opted into your Twilio Sandbox for testing.
    const adminNum = ADMIN_TELEGRAM_CHAT_ID;
    const managerNum = MANAGER_TELEGRAM_CHAT_ID;
    const ownerNum = OWNER_TELEGRAM_CHAT_ID;

     if (ownerNum) {
        await sendTelegramMessage(ownerNum, message);
    } else {
        console.warn('Owner Telegram chat ID not configured. Skipping admin notification.');
    }

    if (adminNum) {
        await sendTelegramMessage(adminNum, message);
    } else {
        console.warn('Admin Telegram chat ID not configured. Skipping admin notification.');
    }

    if (managerNum) {
        await sendTelegramMessage(managerNum, message);
    } else {
        console.warn('Manager Telegram chat ID not configured. Skipping manager notification.');
    }
}

module.exports = {
    sendTelegramMessage,
    notifyAdminAndManagerTelegram
};