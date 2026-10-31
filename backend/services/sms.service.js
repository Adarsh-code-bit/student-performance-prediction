const crypto = require('crypto');

/**
 * Quick-Commerce SMS Notification & Verification Service
 * Supports multiple providers:
 *   - 'CONSOLE' / 'MOCK': Safe local development & testing mode (strictly forbidden in production)
 *   - 'TWILIO': Twilio Programmable SMS
 *   - 'AWS_SNS': Amazon Simple Notification Service
 *   - 'CUSTOM_HTTP': Generic webhook / HTTP SMS gateway
 *   - 'NONE': Unconfigured (fails safely)
 */

class SmsService {
  constructor() {
    this._testDispatchedOtps = new Map();
  }

  /**
   * Retrieves active provider dynamically to allow environment configuration changes.
   */
  getProvider() {
    const raw = process.env.SMS_PROVIDER;
    if (raw && raw !== 'undefined') {
      return raw.toUpperCase();
    }
    return (process.env.NODE_ENV === 'production' ? 'NONE' : 'CONSOLE').toUpperCase();
  }

  /**
   * Generates a cryptographically strong 6-digit numeric OTP in the range [100000, 999999].
   */
  generateOtp() {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Hashes the OTP using HMAC-SHA256 with an application secret salt
   * to ensure OTPs are never stored in plaintext in the database.
   */
  hashOtp(otp, phone) {
    const salt = process.env.OTP_SECRET_SALT || 'quickstock_otp_salt_v4';
    return crypto.createHmac('sha256', salt).update(`${phone}:${otp}`).digest('hex');
  }

  /**
   * Verifies an entered OTP against the stored hash safely.
   * Uses constant-time buffer comparison to prevent timing attacks.
   */
  verifyOtpHash(enteredOtp, phone, storedHash) {
    if (!enteredOtp || !phone || !storedHash || typeof storedHash !== 'string') {
      return false;
    }
    const enteredHash = this.hashOtp(enteredOtp, phone);
    const bufEntered = Buffer.from(enteredHash, 'utf8');
    const bufStored = Buffer.from(storedHash, 'utf8');
    if (bufEntered.length !== bufStored.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufEntered, bufStored);
  }

  /**
   * Test-only helper to inspect dispatched OTP in automated test suites.
   * Strictly blocked and returns null in production mode.
   */
  getTestOtp(phone) {
    if (process.env.NODE_ENV === 'production') {
      return null;
    }
    return this._testDispatchedOtps.get(phone) || null;
  }

  /**
   * Sends an OTP to the given phone number using the configured SMS provider.
   */
  async sendOtp(phone, otp) {
    const provider = this.getProvider();
    const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';

    // In production mode, mock or console providers are strictly prohibited
    if (isProduction && ['CONSOLE', 'MOCK', 'DEV'].includes(provider)) {
      throw new Error(
        'Development/Mock SMS provider is strictly prohibited in production mode. Configure TWILIO, AWS_SNS, or CUSTOM_HTTP.'
      );
    }

    const message = `[QUICKSTOCK WMS] Your verification code is ${otp}. Valid for 5 minutes. Do not share this code.`;

    switch (provider) {
      case 'CONSOLE':
      case 'MOCK':
      case 'DEV': {
        // Safe dev/test mock dispatch
        if (!isProduction) {
          this._testDispatchedOtps.set(phone, otp);
        }

        // Avoid logging plaintext OTPs in test and production environments
        if (process.env.NODE_ENV !== 'test') {
          const maskedPhone = phone.length > 5 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
          console.log(`\n📱 [SMS GATEWAY (DEV/MOCK)] To: ${maskedPhone} | Provider: ${provider}`);
        }

        return {
          success: true,
          provider,
          mock: true,
          message: 'OTP delivered to terminal emulator (Development Mode)'
        };
      }

      case 'TWILIO': {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !fromNumber) {
          throw new Error('Twilio SMS provider is selected but required credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) are not configured.');
        }

        // Twilio API integration via standard https request
        const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const postData = new URLSearchParams({
          To: phone,
          From: fromNumber,
          Body: message
        }).toString();

        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: postData
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(`Twilio SMS delivery failed: ${errData.message || response.statusText}`);
        }

        return { success: true, provider: 'TWILIO' };
      }

      case 'AWS_SNS': {
        const accessKey = process.env.AWS_ACCESS_KEY_ID;
        const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
        const region = process.env.AWS_REGION || 'us-east-1';

        if (!accessKey || !secretKey) {
          throw new Error('AWS SNS SMS provider is selected but required credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are not configured.');
        }

        throw new Error('AWS SNS delivery requires AWS SDK configuration with verified SMS origination number.');
      }

      case 'CUSTOM_HTTP': {
        const gatewayUrl = process.env.SMS_GATEWAY_URL;
        const apiKey = process.env.SMS_GATEWAY_API_KEY;

        if (!gatewayUrl) {
          throw new Error('Custom HTTP SMS provider selected but SMS_GATEWAY_URL is not configured.');
        }

        const response = await fetch(gatewayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
          },
          body: JSON.stringify({ phone, message, otp })
        });

        if (!response.ok) {
          throw new Error(`HTTP SMS gateway delivery failed with status ${response.status}`);
        }

        return { success: true, provider: 'CUSTOM_HTTP' };
      }

      case 'NONE':
      default:
        // Do not pretend that an OTP was sent if the SMS provider is not configured
        throw new Error(
          'SMS provider is not configured. Please set SMS_PROVIDER (TWILIO, AWS_SNS, or CUSTOM_HTTP) in backend configuration.'
        );
    }
  }
}

module.exports = new SmsService();
