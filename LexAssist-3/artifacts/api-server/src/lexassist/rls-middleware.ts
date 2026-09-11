import type { Request, Response, NextFunction } from "express";
import { pool, rlsAls } from "./db";
import { isPublicApiPath } from "./sessions";

export function rlsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.originalUrl.startsWith("/api")) {
    return next();
  }

  void (async () => {
    const client = await pool.connect();
    let released = false;
    let finishing = false;

    const release = async (rollback: boolean) => {
      if (released) return;
      released = true;
      try {
        await client.query(rollback ? "ROLLBACK" : "COMMIT");
      } catch {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* ignore */
        }
      }
      client.release();
    };

    try {
      await client.query("BEGIN");
      const orgId = (req as any).organisationId as number | undefined;
      const publicPath = isPublicApiPath(req);
      if (orgId != null) {
        await client.query("SELECT set_config('app.current_org_id', $1, true)", [String(orgId)]);
      } else if (publicPath) {
        await client.query("SELECT set_config('app.rls_bypass', 'on', true)");
      }

      const origEnd = res.end.bind(res);
      res.end = function rlsEnd(chunk?: any, encoding?: any, cb?: any) {
        if (released) {
          return origEnd(chunk, encoding, cb);
        }
        if (finishing) {
          return res;
        }
        finishing = true;
        const rollback = res.statusCode >= 500;
        void release(rollback).then(() => origEnd(chunk, encoding, cb));
        return res;
      } as typeof res.end;

      rlsAls.run(
        { client, orgId: orgId ?? null, bypass: publicPath && orgId == null },
        () => {
          try {
            next();
          } catch (err) {
            void release(true).then(() => next(err as Error));
          }
        },
      );
    } catch (err) {
      await release(true);
      next(err);
    }
  })();
}
