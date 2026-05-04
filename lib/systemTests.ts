export type TestId =
  | "application"
  | "approval"
  | "submission";

export const TEST_IDS: TestId[] = [
  "application",
  "approval",
  "submission",
];

export type TestResult = {
  id: TestId;
  name: string;
  status: "PASS" | "FAIL";
  message: string;
  ms: number;
};
