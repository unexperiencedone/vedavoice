import twilio from 'twilio';
import { generateVerificationSms } from './sms_templates';
import { supabase } from './supabase';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

// Only initialize if we have the credentials
const client = (accountSid && accountSid !== 'AC_your_account_sid_here' && authToken && authToken !== 'your_auth_token_here') 
  ? twilio(accountSid, authToken) 
  : null;

/**
 * TWILIO PRODUCTION SMS GATEWAY
 */
export async function sendTwilioVerification(
  txnId: string,
  phone: string,
  name: string,
  amount: number,
  token: string,
  language: string = 'en'
) {
  if (!client) {
    console.warn('❌ TWILIO_NOT_CONFIGURED: Falling back to simulation logic.');
    return { success: false, reason: 'unconfigured' };
  }

  // Format the 1/2 Reply Protocol msg
  const body = generateVerificationSms(name, amount, token, language);

  try {
    const message = await client.messages.create({
      body: body,
      from: twilioNumber,
      to: phone
    });

    // Save record to database
    await supabase
      .from('transactions')
      .update({ 
        verification_token: token,
        verification_status: 'verifying',
        verification_msg: body
      })
      .eq('id', txnId);

    console.log(`✅ TWILIO_LIVE_DISPATCH [${phone}]: SID ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (error: any) {
    console.error('❌ TWILIO_DISPATCH_ERROR:', error.message);
    throw error;
  }
}
