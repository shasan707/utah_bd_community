"use client";

import { useState } from "react";

/** Visible-version contact form that opens the visitor's email app via mailto. */
export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`
    );
    window.location.href = `mailto:hello@uthausa.org?subject=${encodeURIComponent(
      "Message from Utha USA website"
    )}&body=${body}`;
  };

  const inputCls =
    "w-full rounded-xl border border-sand bg-white px-4 py-3 text-forest-ink outline-none transition-colors focus:border-forest";

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-sand bg-cream-dim p-7"
    >
      <label className="block text-sm font-semibold text-forest-ink">
        Your name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputCls} mt-1.5`}
          placeholder="Rahim Uddin"
        />
      </label>
      <label className="mt-4 block text-sm font-semibold text-forest-ink">
        Email
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${inputCls} mt-1.5`}
          placeholder="you@example.com"
        />
      </label>
      <label className="mt-4 block text-sm font-semibold text-forest-ink">
        Message
        <textarea
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${inputCls} mt-1.5 resize-none`}
          placeholder="Hello! I'd like to..."
        />
      </label>
      <button
        type="submit"
        className="mt-6 w-full rounded-full bg-bengal-red py-3.5 font-semibold text-white transition-transform hover:scale-[1.02]"
      >
        Send Message
      </button>
      <p className="mt-3 text-center text-xs text-forest-ink/50">
        Opens your email app. A live inbox form arrives with the next version.
      </p>
    </form>
  );
}
