export type GalleryItem = {
  id: number;
  caption: string;
  banglaCaption: string; // display title (English per site language decision)
  palette: "green" | "red" | "gold" | "teal";
  tall?: boolean;
  src?: string;
};

// Placeholder gallery. Swap with real event photos later.
export const gallery: GalleryItem[] = [
  { id: 1, caption: "Boishakhi Mela", banglaCaption: "Mela Procession", palette: "red", tall: true },
  { id: 2, caption: "Winter festival", banglaCaption: "Pitha Spread", palette: "gold" },
  { id: 3, caption: "Ekushey February", banglaCaption: "Morning Procession", palette: "green" },
  { id: 4, caption: "Children's corner", banglaCaption: "Kids' Art", palette: "teal", tall: true },
  { id: 5, caption: "Victory Day", banglaCaption: "Freedom Songs", palette: "red" },
  { id: 6, caption: "Eid Reunion", banglaCaption: "Eid Together", palette: "teal" },
  { id: 7, caption: "Summer picnic", banglaCaption: "Tug of War", palette: "green", tall: true },
  { id: 8, caption: "Cultural evening", banglaCaption: "Stage Finale", palette: "gold" },
  { id: 9, caption: "Boishakhi Mela", banglaCaption: "Alpona Painting", palette: "red" },
  { id: 10, caption: "Sports day", banglaCaption: "Cricket Champions", palette: "green" },
  { id: 11, caption: "Community evening", banglaCaption: "Cha & Adda", palette: "gold", tall: true },
  { id: 12, caption: "Our people", banglaCaption: "Volunteer Team", palette: "teal" },
];
