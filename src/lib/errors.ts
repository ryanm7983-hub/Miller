import { PermissionError, TenantAccessError } from '@/lib/tenant';
import { PlanLimitError } from '@/lib/billing';

/**
 * Turns a domain error into a message that is safe and useful to show a user.
 *
 * Known domain errors already carry human-readable text written for the person
 * who hit them. Anything else is deliberately generic — an unexpected error's
 * message can leak internals, so the detail stays in the server log.
 */
export function toFormError(error: unknown): string {
  if (error instanceof PlanLimitError || error instanceof PermissionError || error instanceof TenantAccessError) {
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  console.error('[action] unexpected error', error);
  return 'Something went wrong. Please try again.';
}
