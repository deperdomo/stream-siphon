import { NextRequest } from 'next/server';

// Store active connections
const connections = new Map<string, ReadableStreamDefaultController>();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Session ID required', { status: 400 });
  }

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      // Store this connection
      connections.set(sessionId, controller);

      // Send initial connection message
      const data = `data: ${JSON.stringify({
        type: 'connected',
        message: 'Conectado al servidor de progreso'
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));
    },
    cancel() {
      // Clean up connection when client disconnects
      connections.delete(sessionId);
    }
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

// Helper function to send progress updates
export function sendProgressUpdate(sessionId: string, progress: number, message: string) {
  const controller = connections.get(sessionId);
  if (controller) {
    const data = `data: ${JSON.stringify({
      type: 'progress',
      progress,
      message
    })}\n\n`;
    controller.enqueue(new TextEncoder().encode(data));
  }
}

// Helper function to send completion message
export function sendCompletion(sessionId: string, message: string = 'Descarga completada') {
  const controller = connections.get(sessionId);
  if (controller) {
    const data = `data: ${JSON.stringify({
      type: 'complete',
      message
    })}\n\n`;
    controller.enqueue(new TextEncoder().encode(data));
    controller.close();
    connections.delete(sessionId);
  }
}

// Helper function to send error message
export function sendError(sessionId: string, message: string) {
  const controller = connections.get(sessionId);
  if (controller) {
    const data = `data: ${JSON.stringify({
      type: 'error',
      message
    })}\n\n`;
    controller.enqueue(new TextEncoder().encode(data));
    controller.close();
    connections.delete(sessionId);
  }
}