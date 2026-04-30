export type TestId =
  | "application"
  | "approval"
  | "submission"
  | "signature";

export const TEST_IDS: TestId[] = [
  "application",
  "approval",
  "submission",
  "signature",
];

export type TestResult = {
  id: TestId;
  name: string;
  status: "PASS" | "FAIL";
  message: string;
  ms: number;
};
