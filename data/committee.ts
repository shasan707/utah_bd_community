export type CommitteeMember = {
  name: string;
  role: string;
  initials: string;
  palette: "green" | "red" | "gold" | "teal";
};

// Placeholder names — replace with the real Utha USA committee.
export const committee: CommitteeMember[] = [
  { name: "Mahmudul Hasan", role: "President", initials: "MH", palette: "green" },
  { name: "Farzana Akter", role: "General Secretary", initials: "FA", palette: "red" },
  { name: "Rezaul Karim", role: "Treasurer", initials: "RK", palette: "gold" },
  { name: "Nusrat Jahan", role: "Cultural Secretary", initials: "NJ", palette: "teal" },
  { name: "Tanvir Ahmed", role: "Event Coordinator", initials: "TA", palette: "red" },
  { name: "Sharmin Sultana", role: "Youth & Education", initials: "SS", palette: "green" },
  { name: "Abdul Malek", role: "Sports Secretary", initials: "AM", palette: "teal" },
  { name: "Taslima Begum", role: "Welfare Secretary", initials: "TB", palette: "gold" },
];
