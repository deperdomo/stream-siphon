import { NextRequest } from 'next/server';
import {
  createSseMessage,
  registerConnection,
  unregisterConnection,
} from './stream-manager';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Session ID required', { status: 400 });
  }

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      registerConnection(sessionId, controller);
      controller.enqueue(
        createSseMessage({
          type: 'connected',
          message: 'Conectado al servidor de progreso',
        })
      );
    },
    cancel() {
      unregisterConnection(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}
