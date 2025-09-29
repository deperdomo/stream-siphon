const connections = new Map<string, ReadableStreamDefaultController>();
const encoder = new TextEncoder();

export function registerConnection(sessionId: string, controller: ReadableStreamDefaultController) {
  connections.set(sessionId, controller);
}

export function unregisterConnection(sessionId: string) {
  connections.delete(sessionId);
}

export function createSseMessage(payload: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export function sendProgressUpdate(sessionId: string, progress: number, message: string) {
  const controller = connections.get(sessionId);
  if (!controller) return;

  controller.enqueue(
    createSseMessage({
      type: 'progress',
      progress,
      message,
    })
  );
}

export function sendCompletion(sessionId: string, message: string = 'Descarga completada') {
  const controller = connections.get(sessionId);
  if (!controller) return;

  controller.enqueue(
    createSseMessage({
      type: 'complete',
      message,
    })
  );
  controller.close();
  connections.delete(sessionId);
}

export function sendError(sessionId: string, message: string) {
  const controller = connections.get(sessionId);
  if (!controller) return;

  controller.enqueue(
    createSseMessage({
      type: 'error',
      message,
    })
  );
  controller.close();
  connections.delete(sessionId);
}
