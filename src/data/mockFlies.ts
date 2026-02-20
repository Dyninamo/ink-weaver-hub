import type { RecommendedFly } from "@/types/flySelector";

export const MOCK_FLIES: RecommendedFly[] = [
  { rank: 1, name: "Black Buzzer", hookSize: 12, colours: ["black", "red"], category: "Buzzer", source: "diary", catchPercent: 68, useCount: 34, variations: [
    { label: "Size 10", hookSize: 10, colours: ["black", "red"] },
    { label: "Size 14", hookSize: 14, colours: ["black", "red"] },
    { label: "Olive", hookSize: 12, colours: ["olive", "black"] },
  ]},
  { rank: 2, name: "Olive Buzzer", hookSize: 12, colours: ["olive", "black"], category: "Buzzer", source: "report", confidence: 0.91, variations: [
    { label: "Size 10", hookSize: 10, colours: ["olive", "black"] },
    { label: "Size 14", hookSize: 14, colours: ["olive", "black"] },
  ]},
  { rank: 3, name: "Epoxy Buzzer", hookSize: 10, colours: ["black", "red"], category: "Buzzer", source: "diary", catchPercent: 52, useCount: 21, variations: [
    { label: "Size 12", hookSize: 12, colours: ["black", "red"] },
    { label: "Red", hookSize: 10, colours: ["red", "black"] },
  ]},
  { rank: 4, name: "Shipman's Buzzer", hookSize: 14, colours: ["ginger", "orange"], category: "Buzzer", source: "report", confidence: 0.84, variations: [
    { label: "Size 12", hookSize: 12, colours: ["ginger", "orange"] },
    { label: "Claret", hookSize: 14, colours: ["claret", "red"] },
  ]},
  { rank: 5, name: "Red Buzzer", hookSize: 12, colours: ["red", "black"], category: "Buzzer", source: "diary", catchPercent: 45, useCount: 18, variations: [
    { label: "Size 10", hookSize: 10, colours: ["red", "black"] },
    { label: "Size 14", hookSize: 14, colours: ["red", "black"] },
  ]},
  { rank: 6, name: "CDC Emerger Buzzer", hookSize: 14, colours: ["black", "grey"], category: "Buzzer", source: "report", confidence: 0.72, variations: [
    { label: "Size 12", hookSize: 12, colours: ["black", "grey"] },
    { label: "Olive", hookSize: 14, colours: ["olive", "grey"] },
  ]},
  { rank: 7, name: "Apps Bloodworm", hookSize: 10, colours: ["red"], category: "Buzzer", source: "diary", catchPercent: 38, useCount: 12, variations: [
    { label: "Size 8", hookSize: 8, colours: ["red"] },
    { label: "Size 12", hookSize: 12, colours: ["red"] },
  ]},
  { rank: 8, name: "Blob (Orange)", hookSize: 10, colours: ["orange"], category: "Lure", source: "report", confidence: 0.88, variations: [
    { label: "Size 8", hookSize: 8, colours: ["orange"] },
    { label: "Tequila", hookSize: 10, colours: ["orange", "lime"] },
  ]},
  { rank: 9, name: "Booby (Olive)", hookSize: 10, colours: ["olive"], category: "Lure", source: "diary", catchPercent: 55, useCount: 22, variations: [
    { label: "Size 8", hookSize: 8, colours: ["olive"] },
    { label: "White", hookSize: 10, colours: ["white"] },
  ]},
  { rank: 10, name: "Cat's Whisker", hookSize: 10, colours: ["chartreuse", "white"], category: "Lure", source: "report", confidence: 0.76, variations: [
    { label: "Size 8", hookSize: 8, colours: ["chartreuse", "white"] },
    { label: "Size 12", hookSize: 12, colours: ["chartreuse", "white"] },
  ]},
  { rank: 11, name: "Olive Snake", hookSize: 8, colours: ["olive"], category: "Lure", source: "diary", catchPercent: 41, useCount: 15, variations: [
    { label: "Size 10", hookSize: 10, colours: ["olive"] },
    { label: "Black", hookSize: 8, colours: ["black", "gold"] },
  ]},
  { rank: 12, name: "Humongous", hookSize: 10, colours: ["orange", "gold"], category: "Lure", source: "report", confidence: 0.65, variations: [
    { label: "Size 8", hookSize: 8, colours: ["orange", "gold"] },
    { label: "Size 12", hookSize: 12, colours: ["orange", "gold"] },
  ]},
  { rank: 13, name: "Damsel Nymph", hookSize: 10, colours: ["olive"], category: "Lure", source: "diary", catchPercent: 36, useCount: 11, variations: [
    { label: "Size 12", hookSize: 12, colours: ["olive"] },
    { label: "Gold Head", hookSize: 10, colours: ["olive", "gold"] },
  ]},
  { rank: 14, name: "Gold Ribbed Hare's Ear", hookSize: 12, colours: ["brown", "gold"], category: "Nymph", source: "report", confidence: 0.82, variations: [
    { label: "Size 10", hookSize: 10, colours: ["brown", "gold"] },
    { label: "Size 14", hookSize: 14, colours: ["brown", "gold"] },
    { label: "Olive", hookSize: 12, colours: ["olive", "gold"] },
  ]},
  { rank: 15, name: "Pink Shrimp", hookSize: 12, colours: ["pink"], category: "Nymph", source: "diary", catchPercent: 48, useCount: 25, variations: [
    { label: "Size 10", hookSize: 10, colours: ["pink"] },
    { label: "Orange", hookSize: 12, colours: ["orange"] },
  ]},
  { rank: 16, name: "Diawl Bach", hookSize: 12, colours: ["peacock", "red"], category: "Nymph", source: "report", confidence: 0.71, variations: [
    { label: "Size 10", hookSize: 10, colours: ["peacock", "red"] },
    { label: "Size 14", hookSize: 14, colours: ["peacock", "red"] },
  ]},
  { rank: 17, name: "Pheasant Tail", hookSize: 14, colours: ["brown", "copper"], category: "Nymph", source: "diary", catchPercent: 42, useCount: 19, variations: [
    { label: "Size 12", hookSize: 12, colours: ["brown", "copper"] },
    { label: "Size 16", hookSize: 16, colours: ["brown", "copper"] },
  ]},
  { rank: 18, name: "Hothead Damsel", hookSize: 10, colours: ["olive", "orange"], category: "Nymph", source: "report", confidence: 0.58, variations: [
    { label: "Size 12", hookSize: 12, colours: ["olive", "orange"] },
    { label: "Pink Head", hookSize: 10, colours: ["olive", "pink"] },
  ]},
  { rank: 19, name: "Cruncher", hookSize: 12, colours: ["olive", "brown"], category: "Nymph", source: "diary", catchPercent: 33, useCount: 9, variations: [
    { label: "Size 10", hookSize: 10, colours: ["olive", "brown"] },
    { label: "Size 14", hookSize: 14, colours: ["olive", "brown"] },
  ]},
  { rank: 20, name: "CDC & Elk", hookSize: 14, colours: ["tan", "grey"], category: "Dry", source: "diary", catchPercent: 58, useCount: 14, variations: [
    { label: "Size 12", hookSize: 12, colours: ["tan", "grey"] },
    { label: "Size 16", hookSize: 16, colours: ["tan", "grey"] },
  ]},
  { rank: 21, name: "Hopper (Olive)", hookSize: 12, colours: ["olive", "brown"], category: "Dry", source: "report", confidence: 0.63, variations: [
    { label: "Size 10", hookSize: 10, colours: ["olive", "brown"] },
    { label: "Red", hookSize: 12, colours: ["red", "brown"] },
  ]},
  { rank: 22, name: "Griffith's Gnat", hookSize: 16, colours: ["grey", "peacock"], category: "Dry", source: "report", confidence: 0.48, variations: [
    { label: "Size 14", hookSize: 14, colours: ["grey", "peacock"] },
    { label: "Size 18", hookSize: 18, colours: ["grey", "peacock"] },
  ]},
  { rank: 23, name: "Daddy Long Legs", hookSize: 10, colours: ["tan", "brown"], category: "Dry", source: "report", confidence: 0.44, variations: [
    { label: "Size 8", hookSize: 8, colours: ["tan", "brown"] },
    { label: "Size 12", hookSize: 12, colours: ["tan", "brown"] },
  ]},
  { rank: 24, name: "Black Pennell", hookSize: 12, colours: ["black"], category: "Wet", source: "diary", catchPercent: 31, useCount: 8, variations: [
    { label: "Size 10", hookSize: 10, colours: ["black"] },
    { label: "Size 14", hookSize: 14, colours: ["black"] },
  ]},
  { rank: 25, name: "Bibio", hookSize: 12, colours: ["black", "red"], category: "Wet", source: "report", confidence: 0.52, variations: [
    { label: "Size 10", hookSize: 10, colours: ["black", "red"] },
    { label: "Size 14", hookSize: 14, colours: ["black", "red"] },
  ]},
];
