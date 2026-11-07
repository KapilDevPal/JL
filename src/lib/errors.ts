// Error codes raised by the SQL functions, mapped to plain language.
const MESSAGES: Record<string, string> = {
  INSUFFICIENT_STOCK: 'There is not enough stock to send this request.',
  ALREADY_PROCESSED: 'This request has already been handled.',
  NOT_ALLOWED: 'You do not have permission to do that.',
  REQUEST_NOT_FOUND: 'This request no longer exists.',
  PRODUCT_NOT_FOUND: 'This product no longer exists.',
  STOCK_CHANGED:
    'Stock changed while you were editing. The latest numbers are now shown. Check them and save again.',
  INVALID_QUANTITY: 'Quantities must be whole numbers of 0 or more.',
  USER_NOT_FOUND: 'No account uses that email. Create the account first, then assign it.',
  'Invalid login credentials': 'Email or password is incorrect.',
  'Network request failed': 'No internet connection. Please try again when you are online.',
};

export function friendlyError(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  for (const [code, text] of Object.entries(MESSAGES)) {
    if (message.includes(code)) return text;
  }
  return 'Something went wrong. Please try again.';
}

export function isError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && String((error as { message?: unknown }).message).includes(code);
}
