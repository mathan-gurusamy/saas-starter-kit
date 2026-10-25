import crypto from 'node:crypto';

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'org';
}

/** Slug with a short random suffix so two orgs named "Acme" never collide. */
export function uniqueSlug(name: string): string {
  return `${slugify(name)}-${crypto.randomBytes(3).toString('hex')}`;
}
