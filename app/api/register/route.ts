import {
  ApiError,
  clientIpOf,
  jsonError,
  jsonOk,
  readJsonBody,
} from "@/lib/supabase-server";
import { computeAmount } from "@/lib/payments/pricing";
import { getSettings, openState } from "@/lib/payments/settings";
import {
  checkThrottle,
  createRegistration,
  findRecentPending,
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

    const settings = await getSettings();
    if (openState(settings) !== "open") {
      throw new ApiError(403, "Registration is closed.");
    }

    const input = validateRegistrationInput(body, "web");
    const amount = computeAmount(input, settings);
    if (amount <= 0) throw new ApiError(400, "Amount is zero.");

    const existing = await findRecentPending(input.email, amount);
    if (existing) {
      return jsonOk({ ...toCreateResult(existing, settings), reused: true });
    }

    const ip = clientIpOf(req);
    await checkThrottle(input.email, ip);

    const { row } = await createRegistration(
      input,
      { createdBy: "web", clientIp: ip },
      settings
    );
    return jsonOk({ ...toCreateResult(row, settings), reused: false });
  } catch (err) {
    return jsonError(err);
  }
}
