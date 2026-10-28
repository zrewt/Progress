export type AgeBracket = "under_13" | "13_17" | "18_plus";
export const AGE_OPTIONS = [{ value: "under_13", label: "Under 13" }, { value: "13_17", label: "13 to 17" }, { value: "18_plus", label: "18 or over" }] as const;
export function eligibleAge(age: unknown): age is "13_17" | "18_plus" { return age === "13_17" || age === "18_plus"; }
export const UNDER_13_MESSAGE = "Vitality Tree is for people aged 13 or over. Please ask a trusted adult to help you find something suitable.";
