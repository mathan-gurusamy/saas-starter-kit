import { describe, expect, it } from 'vitest';
import { hasRole } from './roles';

describe('hasRole', () => {
  it('owner satisfies every requirement', () => {
    expect(hasRole('OWNER', 'OWNER')).toBe(true);
    expect(hasRole('OWNER', 'ADMIN')).toBe(true);
    expect(hasRole('OWNER', 'MEMBER')).toBe(true);
  });

  it('admin cannot act as owner', () => {
    expect(hasRole('ADMIN', 'OWNER')).toBe(false);
    expect(hasRole('ADMIN', 'ADMIN')).toBe(true);
  });

  it('member only satisfies member', () => {
    expect(hasRole('MEMBER', 'ADMIN')).toBe(false);
    expect(hasRole('MEMBER', 'MEMBER')).toBe(true);
  });
});
