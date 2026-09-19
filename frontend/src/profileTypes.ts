import { withKeys, type Keyed } from "./rows";

export type Criterion = { name: string; description: string; weight: number };
export type Profile = {
  id: string;
  name: string;
  category: "Resume" | "Document" | "Image" | "Custom";
  description: string;
  input_label: string;
  accepted_types: string[];
  criteria: Criterion[];
};
export type ProfileDraft = Omit<Profile, "criteria"> & {
  criteria: Keyed<Criterion>[];
};
export const toDraft = (profile: Profile): ProfileDraft => ({
  ...structuredClone(profile),
  criteria: withKeys(profile.criteria),
});
export const blank = (): Profile => ({
  id: "",
  name: "",
  category: "Resume",
  description: "",
  input_label: "Resume",
  accepted_types: ["pdf"],
  criteria: [{ name: "", description: "", weight: 1 }],
});
export const templates: Record<string, Profile> = {
  Resume: {
    ...blank(),
    name: "Senior Product Designer",
    description:
      "We are looking for a Senior Product Designer to lead end-to-end design for a B2B SaaS product. The role works with product managers and engineers to turn complex workflows into clear user experiences. Candidates should show experience with user research, interaction design, and design systems.",
    criteria: [
      {
        name: "Product design experience",
        description:
          "At least 5 years of experience designing and shipping digital products.",
        weight: 3,
      },
      {
        name: "User research",
        description:
          "Evidence of planning user interviews, usability tests, and using findings in design decisions.",
        weight: 2,
      },
      {
        name: "Design systems",
        description:
          "Experience creating or maintaining reusable components and design guidelines.",
        weight: 2,
      },
      {
        name: "Cross-functional work",
        description:
          "Experience working with product managers and engineers to ship products.",
        weight: 1,
      },
    ],
  },
  Document: {
    ...blank(),
    category: "Document",
    input_label: "Document",
    name: "Project proposal review",
    description:
      "Review a project proposal for completeness and a clear delivery plan.",
    criteria: [
      {
        name: "Clear scope",
        description:
          "The proposal defines the problem, goals, and deliverables.",
        weight: 3,
      },
      {
        name: "Delivery plan",
        description:
          "The proposal includes a timeline, owners, and milestones.",
        weight: 2,
      },
      {
        name: "Risks and costs",
        description:
          "The proposal identifies costs, risks, and mitigation steps.",
        weight: 2,
      },
    ],
  },
};
