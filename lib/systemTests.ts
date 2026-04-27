export type TestId =
  | "application"
  | "approval"
  | "referral"
  | "signature";

export const TEST_IDS: TestId[] = [
  "application",
  "approval",
  "referral",
  "signature",
];

export type TestResult = {
  id: TestId;
  name: string;
  status: "PASS" | "FAIL";
  message: string;
  ms: number;
};
