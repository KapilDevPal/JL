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
  INVALID_IMAGES: 'A product can have up to 8 photos.',
  INVALID_IMPORT_ROW: 'A row in the file has a missing name or an invalid quantity.',
  DUPLICATE_NAMES: 'The file lists the same product name more than once.',
  AMBIGUOUS_NAME: 'More than one existing product has a name from the file. Rename them so each name is unique.',
  INVALID_IMPORT: 'The file must have between 1 and 1000 products.',
  INVALID_NAME: 'Names can be up to 80 characters.',
  UNSUPPORTED_FILE: 'Choose a .csv, .xlsx or .xls file.',
  'Could not read the photo': 'Could not read that photo. Please try another one.',
  USER_NOT_FOUND: 'No account uses that email. Create the account first, then assign it.',
  'Invalid login credentials': 'Email or password is incorrect.',
  'Network request failed': 'No internet connection. Please try again when you are online.',
};

export function friendlyError(error: unknown): string {
  if (__DEV__) console.warn('[app error]', error);
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
