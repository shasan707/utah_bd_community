/**
 * The association's assistant line, written down once.
 *
 * Both orbs offer it, one to ring and one to text, and the footer or the
 * contact page can use it later without the number being retyped anywhere.
 */

/** E.164, which is what tel: and sms: links need. */
export const ASSISTANT_PHONE = "+18669307859";

/** How the number is read out loud in the United States. */
export const ASSISTANT_PHONE_DISPLAY = "(866) 930-7859";

export const ASSISTANT_TEL = `tel:${ASSISTANT_PHONE}`;
export const ASSISTANT_SMS = `sms:${ASSISTANT_PHONE}`;
