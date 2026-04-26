export type TestId =
  | "application"
  | "approval"
  | "referral"
  | "fcfs"
  | "signature";

export const TEST_IDS: TestId[] = [
  "application",
  "approval",
  "referral",
  "fcfs",
  "signature",
];

export type TestResult = {
  id: TestId;
  name: string;
  status: "PASS" | "FAIL";
  message: string;
  ms: number;
};
