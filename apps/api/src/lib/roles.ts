export type RoleName = 'OWNER' | 'ADMIN' | 'MEMBER';

const RANK: Record<RoleName, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

/** True when `actual` is at least as privileged as `required`. */
export const hasRole = (actual: RoleName, required: RoleName): boolean => RANK[actual] >= RANK[required];
