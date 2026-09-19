import {
  BriefcaseBusiness,
  FileText,
  LayoutDashboard,
  Settings2,
  Target,
} from "lucide-react";

/** One entry per workspace page: drives the sidebar, the breadcrumb and the page heading. */
export const PAGES = [
  {
    id: "review",
    label: "Review",
    icon: LayoutDashboard,
    eyebrow: "A CLEARER PICTURE",
    title: "Find the right fit.",
    blurb: "Turn documents into clear, criteria-based insights.",
  },
  {
    id: "classification",
    label: "PDF classification",
    icon: FileText,
    eyebrow: "SORT YOUR DOCUMENTS",
    title: "PDF classification",
    blurb: "Upload a batch of PDFs and identify what each document is.",
  },
  {
    id: "leads",
    label: "Lead generation",
    icon: Target,
    eyebrow: "FIND YOUR NEXT CUSTOMER",
    title: "Score and route leads.",
    blurb:
      "Match leads to your ICP, score fit and intent, and route them in one step.",
  },
  {
    id: "profiles",
    label: "Profiles",
    icon: BriefcaseBusiness,
    eyebrow: "DEFINE WHAT MATTERS",
    title: "Review profiles",
    blurb: "Manage jobs, descriptions, and the criteria behind every review.",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings2,
    eyebrow: "YOUR WORKSPACE",
    title: "Settings",
    blurb: "Connect TypeSafe to start reviewing your documents.",
  },
] as const;

export type PageId = (typeof PAGES)[number]["id"];

export const pageCopy = (id: string) =>
  PAGES.find((page) => page.id === id) ?? PAGES[0];
