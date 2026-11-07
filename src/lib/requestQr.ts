// QR payload for a request. It only identifies the request: scanning opens
// it, and every action is still checked by the database functions.
const PREFIX = 'stockreq:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requestQrValue(requestId: string): string {
  return PREFIX + requestId;
}

export function parseRequestQr(data: string): string | null {
  if (!data.startsWith(PREFIX)) return null;
  const id = data.slice(PREFIX.length);
  return UUID.test(id) ? id : null;
}
