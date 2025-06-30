// VERSI BARU DENGAN LOGGING DETAIL
const fetch = require('node-fetch');

exports.handler = async (event) => {
  console.log("--- Function execution started. ---");

  if (event.httpMethod !== 'POST') {
    console.log("Error: Method not allowed. Received:", event.httpMethod);
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const orderData = JSON.parse(event.body);
    console.log("1. Order data received:", JSON.stringify(orderData, null, 2));

    const { recaptcha_token } = orderData;
    if (!recaptcha_token) {
        console.error("Error: reCAPTCHA token is missing.");
        return { statusCode: 400, body: JSON.stringify({ message: 'reCAPTCHA token is missing.' }) };
    }

    // --- Verifikasi reCAPTCHA ---
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    console.log("2. Attempting to verify reCAPTCHA...");
    if (!recaptchaSecret) {
        console.error("FATAL ERROR: RECAPTCHA_SECRET_KEY is not set in Netlify environment variables!");
        return { statusCode: 500, body: 'Server configuration error.' };
    }

    const recaptchaRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${recaptchaSecret}&response=${recaptcha_token}`
    });
    const recaptchaJson = await recaptchaRes.json();
    console.log("3. reCAPTCHA verification response:", JSON.stringify(recaptchaJson, null, 2));

    if (!recaptchaJson.success || recaptchaJson.score < 0.5) {
      console.log("Verification failed. Reason:", recaptchaJson['error-codes'] || "Low score");
      return { statusCode: 400, body: JSON.stringify({ message: 'reCAPTCHA verification failed.' }) };
    }

    // --- Teruskan ke N8N ---
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    console.log("4. Attempting to forward to N8N...");
    if (!n8nWebhookUrl) {
        console.error("FATAL ERROR: N8N_WEBHOOK_URL is not set in Netlify environment variables!");
        return { statusCode: 500, body: 'Server configuration error.' };
    }

    delete orderData.recaptcha_token;

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    console.log(`5. N8N response status: ${n8nResponse.status}`);

    if (!n8nResponse.ok) {
        console.error("Error from N8N:", await n8nResponse.text());
        throw new Error('Failed to forward to N8N.');
    }

    console.log("6. Order successfully forwarded to N8N.");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Order submitted successfully.' })
    };

  } catch (error) {
    console.error("--- UNCAUGHT ERROR IN FUNCTION ---", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' })
    };
  }
};