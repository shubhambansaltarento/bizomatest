import '../config/env'; // loads .env

/**
 * Progressive lockout (setting Progressivelockout = 1) as seen on devarun on 17 Nov 2026.
 * Source of truth for specs/user-block/progressive-lockout.md.
 *
 * - Wrong passwords 1 and 2: "Invalid User credentials.."
 * - From the 3rd wrong password on, the n-th blocks the user for n minutes, also when tried while
 *   already blocked (the count goes on, the block gets longer).
 * - The 10th blocks the user until an admin unblocks them; not tested (see `maxAttempts`).
 */
export const userBlock = {
  /** First wrong password that blocks the user. The QA sheet says the 5th; devarun blocks from the 3rd. */
  blockFrom: 3,
  invalidMessage: 'Invalid User credentials..',
  blockedFor: (minutes: number) => `Your account has been blocked for next ${minutes} minutes.`,
  /** Shown for the right password while blocked. */
  stillBlocked: (minutes: number) => `Your account has been blocked It will be unlocked after ${minutes} minutes`,
  minAttempts: 2,
  /** 9, not 10: the 10th wrong password blocks the user for good. */
  maxAttempts: 9,
};

/**
 * How many wrong passwords the test tries: USER_BLOCK_ATTEMPTS in .env, 2 to 9 (default 9).
 * The run then waits that many minutes for the block to end.
 */
export function wrongAttempts(): number {
  const raw = process.env.USER_BLOCK_ATTEMPTS ?? String(userBlock.maxAttempts);
  const attempts = Number(raw);
  if (!Number.isInteger(attempts) || attempts < userBlock.minAttempts || attempts > userBlock.maxAttempts) {
    throw new Error(`USER_BLOCK_ATTEMPTS must be a whole number from ${userBlock.minAttempts} to ${userBlock.maxAttempts}, got "${raw}".`);
  }
  return attempts;
}
