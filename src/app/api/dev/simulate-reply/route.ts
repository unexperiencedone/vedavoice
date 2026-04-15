import { NextRequest, NextResponse } from 'next/server'
import { processVerificationReply } from '@/lib/sms_mock'

/**
 * DEV TOOL: SIMULATE A WORKER REPLY
 * In production, this would be an API triggered by the SMS gateway's hook
 * or a click on the /verify/[token] page.
 */
export async function POST(req: NextRequest) {
  try {
    const { token, response } = await req.json()

    if (!token || !response) {
      return NextResponse.json({ error: 'Missing token or response' }, { status: 400 })
    }

    const updatedTxn = await processVerificationReply(token, response);

    return NextResponse.json({ 
        success: true, 
        newStatus: updatedTxn.verification_status,
        msg: `Transaction verified successfully: ${updatedTxn.verification_status}`
    })
  } catch (error: any) {
    console.error('Simulate Reply Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
