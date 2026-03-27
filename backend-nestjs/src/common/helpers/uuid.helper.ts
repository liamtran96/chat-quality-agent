import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a new UUID v4 string.
 */
export function newUUID(): string {
  return uuidv4();
}
