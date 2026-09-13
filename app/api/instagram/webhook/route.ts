import { NextRequest, NextResponse } from 'next/server'

// ponytail: exists only so Meta's webhook verification handshake passes. We never subscribe to fields; POSTs are ignored.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(q.get('hub.challenge') ?? '', { status: 200 })
  }
  return new NextResponse('forbidden', { status: 403 })
}

export async function POST() {
  return new NextResponse('ok', { status: 200 })
}
