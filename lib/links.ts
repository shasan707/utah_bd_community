/**
 * Where the "Become a Member" / "Learn About Membership" buttons point.
 *
 * The /membership page still exists but is hidden from the site for now, so
 * these send people to the contact page instead. When membership goes live
 * again, change this back to "/membership" and the buttons reconnect —
 * nothing else needs editing. Also restore the Membership links in
 * components/Navbar.tsx and components/Footer.tsx.
 */
export const MEMBERSHIP_HREF = "/contact";
