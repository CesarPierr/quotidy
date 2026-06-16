import "server-only";

import { NextResponse } from "next/server";
import type { HouseholdMember, TaskOccurrence } from "@prisma/client";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageHousehold } from "@/lib/households";
import { logInfo } from "@/lib/logger";
import { isDataRequest, normalizeNextPath, redirectTo } from "@/lib/request";

type ParamsArg<P> = { params: Promise<P> };

type RouteResponse = Response | NextResponse;

/**
 * Build a JSON or redirect response based on whether the call came from a fetch
 * request (`x-requested-with: fetch` / `accept: application/json`) or a native
 * form submission. The destination is computed by the caller.
 */
export function dataOrRedirect(
  request: Request,
  destination: string,
  payload: Record<string, unknown> = {},
  forceRedirect: boolean = true,
) {
  if (isDataRequest(request)) {
    return NextResponse.json({
      ok: true,
      ...(forceRedirect ? { redirectTo: destination } : {}),
      ...payload,
    });
  }
  return redirectTo(request, destination);
}

/**
 * Same as `dataOrRedirect` for the error case: JSON payload for fetch callers,
 * fallback redirect for native form callers.
 */
export function dataErrorOrRedirect(
  request: Request,
  status: number,
  message: string,
  fallback: string,
) {
  if (isDataRequest(request)) {
    return NextResponse.json({ error: message }, { status });
  }
  return redirectTo(request, fallback);
}

type OccurrenceContext<P> = {
  request: Request;
  user: Awaited<ReturnType<typeof requireUser>>;
  params: P;
  occurrence: TaskOccurrence;
  membership: HouseholdMember;
  formData: FormData;
  nextPath: string | null;
  /** Default destination after a successful action. */
  defaultDestination: string;
};

type OccurrenceHandler<P> = (ctx: OccurrenceContext<P>) => Promise<RouteResponse>;

/**
 * Wrap an occurrence-scoped POST route. Handles auth, occurrence lookup,
 * household membership check, formData parsing, and computes a sane default
 * destination from the `nextPath` form field. Returns a 404/403 JSON or a
 * redirect to `/app` when something fails before the handler runs.
 */
export function withOccurrence<P extends { id: string }>(handler: OccurrenceHandler<P>) {
  return async (request: Request, ctx: ParamsArg<P>): Promise<RouteResponse> => {
    const user = await requireUser();
    const params = await ctx.params;

    const occurrence = await db.taskOccurrence.findFirst({
      where: { id: params.id },
    });

    if (!occurrence) {
      return dataErrorOrRedirect(request, 404, "Occurrence introuvable.", "/app");
    }

    const membership = await db.householdMember.findFirst({
      where: { householdId: occurrence.householdId, userId: user.id },
    });

    if (!membership) {
      return dataErrorOrRedirect(request, 403, "Accès refusé.", "/app");
    }

    const formData = await request.formData();
    const nextPath = normalizeNextPath(formData.get("nextPath")?.toString());
    const defaultDestination = nextPath ?? `/app/taches/aujourd-hui?household=${occurrence.householdId}`;

    logInfo("api_occurrence_request", {
      path: request.url,
      method: request.method,
      userId: user.id,
      occurrenceId: occurrence.id,
    });

    return handler({
      request,
      user,
      params,
      occurrence,
      membership,
      formData,
      nextPath,
      defaultDestination,
    });
  };
}

type HouseholdContext<P> = {
  request: Request;
  user: Awaited<ReturnType<typeof requireUser>>;
  params: P;
  membership: HouseholdMember;
  formData: FormData;
  /** True when the membership role is owner or admin. */
  canManage: boolean;
};

type HouseholdHandler<P> = (ctx: HouseholdContext<P>) => Promise<RouteResponse>;

type WithHouseholdOptions = {
  /** When true, the handler returns 403 unless the member has owner/admin role. */
  requireManage?: boolean;
  /** Resolve the householdId from params/form. Defaults to params.id. */
  resolveHouseholdId?: (params: unknown, formData: FormData) => string | undefined;
};

/**
 * Wrap a household-scoped POST route. Handles auth, membership lookup and
 * optional manage-role enforcement. The household id is read from params.id by
 * default; pass `resolveHouseholdId` to read it from the formData instead.
 */
export function withHousehold<P>(
  handler: HouseholdHandler<P>,
  options: WithHouseholdOptions = {},
) {
  return async (request: Request, ctx: ParamsArg<P>): Promise<RouteResponse> => {
    const user = await requireUser();
    const params = await ctx.params;
    const formData = await request.formData();

    const householdId = options.resolveHouseholdId
      ? options.resolveHouseholdId(params, formData)
      : (params as { id?: string }).id;

    if (!householdId) {
      return dataErrorOrRedirect(request, 400, "Foyer manquant.", "/app");
    }

    const membership = await db.householdMember.findFirst({
      where: { householdId, userId: user.id },
    });

    if (!membership) {
      return dataErrorOrRedirect(request, 403, "Accès refusé.", "/app");
    }

    const canManage = canManageHousehold(membership.role);

    if (options.requireManage && !canManage) {
      return dataErrorOrRedirect(request, 403, "Permissions insuffisantes.", "/app");
    }

    logInfo("api_household_request", {
      path: request.url,
      method: request.method,
      userId: user.id,
      householdId,
    });

    return handler({ request, user, params, membership, formData, canManage });
  };
}
