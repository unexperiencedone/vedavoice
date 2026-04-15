import { NextRequest, NextResponse } from 'next/server'
import { sendVerificationSMS } from '@/lib/sms_mock'
import { sendTwilioVerification } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  try {
    const { txnId, phone, name, amount } = await req.json()

    if (!txnId || !phone) {
      return NextResponse.json({ error: 'Missing Data' }, { status: 400 })
    }

    // Generate a simple unique token for this simulation
    const token = Math.random().toString(36).substring(2, 7).toUpperCase();

    // Try Real Twilio first
    let result = await sendTwilioVerification(txnId, phone, name, amount, token);

    // Fallback to Simulation if not configured
    let mode = 'PROD_TWILIO';
    if (!result.success) {
      mode = 'MOCK_SIM';
      await sendVerificationSMS(txnId, phone, name, amount, token);
    }

    return NextResponse.json({ 
        success: true, 
        token, 
        mode,
        msg: `Sent ${mode} verification to ${phone}`
    })
  } catch (error: any) {
    console.error('SMS Send Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
