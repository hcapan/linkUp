/**
 * Demo identity. There is no login: the web app and the Webex bot send the
 * acting person's id (or CEC id) in `x-linkup-user`. Swap this guard for an
 * OIDC/SSO guard later without touching the services, which only see `Viewer`.
 */
import {
  Inject,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Database } from '@linkup/db';
import { DB } from './tokens.js';

export const VIEWER_HEADER = 'x-linkup-user';

export interface Viewer {
  id: string;
  fullName: string;
  cecId: string;
  isAdmin: boolean;
  managerId: string | null;
  /** Direct reports' ids — a manager sees their mentorships. */
  reportIds: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveViewer(db: Database, idOrCec: string): Promise<Viewer | null> {
  const value = idOrCec.trim();
  const where = UUID.test(value) ? sql`p.id = ${value}::uuid` : sql`p.cec_id = ${value.toLowerCase()}`;
  const { rows } = await db.execute<{
    id: string;
    full_name: string;
    cec_id: string;
    is_admin: boolean;
    manager_id: string | null;
    report_ids: string[] | null;
  }>(sql`
    select p.id, p.full_name, p.cec_id, p.is_admin, p.manager_id,
           (select array_agg(r.id) from people r where r.manager_id = p.id) as report_ids
    from people p where ${where} limit 1`);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    cecId: row.cec_id,
    isAdmin: row.is_admin,
    managerId: row.manager_id,
    reportIds: row.report_ids ?? [],
  };
}

@Injectable()
export class ViewerGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Database) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const raw = req.headers[VIEWER_HEADER];
    if (!raw) {
      throw new UnauthorizedException({ code: 'NO_PERSONA', message: `Pick a demo persona (${VIEWER_HEADER} header)` });
    }
    const viewer = await resolveViewer(this.db, String(raw));
    if (!viewer) throw new UnauthorizedException({ code: 'UNKNOWN_PERSONA', message: `Unknown persona "${raw}"` });
    req.viewer = viewer;
    return true;
  }
}

export const CurrentViewer = createParamDecorator((_: unknown, ctx: ExecutionContext): Viewer => {
  return ctx.switchToHttp().getRequest().viewer;
});
