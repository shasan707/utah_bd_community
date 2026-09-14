"use client";

import { useEffect } from "react";

/**
 * The chat assistant, as Retell's own widget in the bottom right corner.
 *
 * This is deliberately their script rather than a hand-built chat window: the
 * widget carries its own history, typing state and reconnection, and Retell
 * keep it working. Only the colours are ours, passed in so it sits with the
 * rest of the site instead of arriving in somebody else's blue.
 *
 * It is loaded once, by hand rather than through next/script, because the tag
 * has to be a module and carry its data attributes at the moment it is parsed.
 * Nothing renders when the public key is missing.
 */

const SCRIPT_ID = "retell-widget";
const SRC = "https://dashboard.retellai.com/retell-widget-v2.js";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY;
const AGENT_ID =
  process.env.NEXT_PUBLIC_RETELL_CHAT_AGENT_ID ||
  "agent_e4ee635091b0cc85b835fae810";

/** Site palette, so the widget matches the page it sits on. */
const FOREST = "#0d4f42";
const IVORY = "#fafaf8";

export default function ChatOrb() {
  useEffect(() => {
    if (!PUBLIC_KEY) return;
    // A client side route change must not add a second widget.
    if (document.getElementById(SCRIPT_ID)) return;

    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SRC;
    s.type = "module";
    s.async = true;

    // Chat only. The voice agent is answered by the orb on the left, and
    // giving this widget a voice agent too would put two ways to call on the
    // same screen.
    s.dataset.publicKey = PUBLIC_KEY;
    s.dataset.agentId = AGENT_ID;
    s.dataset.title = "Bangladeshi Association of Utah";
    s.dataset.botName = "BAU Assistant";
    s.dataset.color = FOREST;
    s.dataset.themeColor = FOREST;
    s.dataset.componentColor = IVORY;
    s.dataset.popupMessage = "Questions about the picnic? Ask us here.";
    s.dataset.showAiPopup = "true";
    s.dataset.showAiPopupTime = "12";
    s.dataset.autoOpen = "false";

    document.body.appendChild(s);
    // Deliberately not removed on unmount: the widget mounts its own DOM
    // outside React, and pulling the script would leave that behind.
  }, []);

  return null;
}
