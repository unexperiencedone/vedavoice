import { generateVerificationSms } from './sms_templates'
import { supabase } from './supabase'

/**
 * MOCK SMS / RCS GATEWAY
 */

export async function sendVerificationSMS(
  txnId: string,
  phone: string,
  name: string,
  amount: number,
  token: string
) {
  const msg = generateVerificationSms(name, amount, token);
  const isDemo = phone === '+91 00000 00000';

  console.log(`\n📲 ${isDemo ? 'DEMO' : 'OUTBOUND'} DISPATCH [${phone}]: ${msg}\n`);

  await supabase
    .from('transactions')
    .update({ 
      verification_token: token,
      verification_status: 'verifying',
      verification_msg: msg
    })
    .eq('id', txnId);

  return { success: true, mode: 'SIMULATED' };
}

/**
 * SIMULATE WORKER REPLY
 * This is the 'Trust Loop' closer.
 */
export async function processVerificationReply(token: string, response: '1' | '2' | 'HAN' | 'NAHI') {
  const status = (response === '1' || response === 'HAN') ? 'confirmed' : 'flagged';
  
  const { data, error } = await supabase
    .from('transactions')
    .update({ 
      verification_status: status,
      verified_at: new Date().toISOString()
    })
    .eq('verification_token', token)
    .select()
    .single();

  if (error) throw error;
  console.log(`✅ VERIFICATION CLOSED [Token: ${token}] => ${status}`);
  return data;
}
