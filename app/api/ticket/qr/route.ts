import QRCode from "qrcode";
import { CODE_PATTERN, normalizeCode } from "@/lib/payments/codes";
import { ticketUrl, verifyTicketToken } from "@/lib/payments/ticket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The QR image for one ticket: /api/ticket/qr?code=R-7X3M&t=<signature>.
 * Only a correctly signed request gets an image, so nobody can mint QRs for
 * other people's codes. The QR itself holds the ticket page link, so a plain
 * camera app opens the ticket and the admin scanner reads the code from it.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = normalizeCode(url.searchParams.get("code") || "");
  const token = url.searchParams.get("t") || "";
  if (!CODE_PATTERN.test(code) || !verifyTicketToken(code, token)) {
    return new Response("Not found", { status: 404 });
  }

  const png = await QRCode.toBuffer(ticketUrl(code), {
    type: "png",
    width: 480,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#123f38", light: "#ffffff" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="ticket-${code}.png"`,
    },
  });
}
