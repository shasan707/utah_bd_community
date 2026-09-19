import {
  ApiError,
  clientIpOf,
  jsonError,
  jsonOk,
  readJsonBody,
  requireAdmin,
} from "@/lib/supabase-server";
import { computeAmount } from "@/lib/payments/pricing";
import { getSettings, openState } from "@/lib/payments/settings";
import {
  checkThrottle,
  createRegistration,
  addToRegistration,
  findRecentPending,
  findTopUpTarget,
  toCreateResult,
  validateRegistrationInput,
} from "@/lib/payments/registrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_FILL_MS = 3000;

/**
 * Public registration. Creates a PENDING row, returns the code and the
 * Zelle instructions. The amount is computed on the server.
 */
export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);

    // Bots fill the hidden field or submit faster than a person can type.
    const startedAt = Number(body.started_at);
    const tooFast =
      Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < MIN_FILL_MS;
    if (body.website || tooFast) {
      throw new ApiError(400, "Something went wrong. Please try again.");
    }

    // A rehearsal. The form only offers the switch to a signed-in admin, but
    // the browser is not trusted to say so: the flag is honoured only when
    // the request also carries a token that Supabase Auth accepts. Anyone
    // else sending it is refused rather than quietly registered for real,
    // because the person asking believes nothing real will happen.
    let isTest = false;
    if (body.test === true) {
      try {
        await requireAdmin(req);
      } catch {
        throw new ApiError(403, "Only a signed-in admin can make a test registration.");
      }
      isTest = true;
    }

    const settings = await getSettings();
    // A rehearsal may run while registration is closed to members; that is
    // when the admin most wants to check the site still works.
    if (openState(settings) !== "open" && !isTest) {
      throw new ApiError(403, "Registration is closed.");
    }

    const input = validateRegistrationInput(body, "web");
    const amount = computeAmount(input, settings);
    if (amount <= 0) {
      throw new ApiError(
        400,
        "The total is zero. Children under 10 are free, so please add at least one adult, a raffle draw coupon, or a donation."
      );
    }

    // The duplicate guard and the throttle are for members. A rehearsal is
    // one admin submitting the same details over and over on purpose.
    const existing = isTest ? null : await findRecentPending(input.email, amount);
    if (existing) {
      return jsonOk({ ...toCreateResult(existing, settings), reused: true });
    }

    const ip = clientIpOf(req);
    if (!isTest) await checkThrottle(input.email, ip);

    // Somebody who has registered before keeps the code they already have,
    // so one person carries one code, one link and one QR for everything
    // they buy. Their earlier ticket is untouched; only the bill grows.
    const target = await findTopUpTarget(input, isTest);
    if (target) {
      const { row } = await addToRegistration(target, input, settings, "web");
      return jsonOk({
        ...toCreateResult(row, settings),
        reused: false,
        added_to_existing: true,
      });
    }

    const { row } = await createRegistration(
      input,
      { createdBy: "web", clientIp: ip, isTest },
      settings
    );
    return jsonOk({ ...toCreateResult(row, settings), reused: false });
  } catch (err) {
    return jsonError(err);
  }
}
