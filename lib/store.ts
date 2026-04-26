"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ApplicationStatus = "none" | "pending" | "approved" | "rejected";

export const FCFS_TOTAL = 50;
export const REFERRAL_LIMIT = 5;

export type State = {
  walletConnected: boolean;
  walletAddress: string | null;
  twitterConnected: boolean;
  discordJoined: boolean;
  retweeted: boolean;
  tagged: boolean;
  tasksCompleted: boolean;
  fcfsApproved: boolean;
  applicationStatus: ApplicationStatus;
  referralCount: number;
  referralLimit: number;
  mintEligible: boolean;
  fcfsRemaining: number;
  referralCode: string | null;
  _hasHydrated: boolean;
};

export type Actions = {
  connectWallet: (addr: string) => void;
  disconnectWallet: () => void;
  setTwitterConnected: (v: boolean) => void;
  setDiscordJoined: (v: boolean) => void;
  setRetweeted: (v: boolean) => void;
  setTagged: (v: boolean) => void;
  setTasksCompleted: (v: boolean) => void;
  tryGrantFcfs: () => boolean;
  decrementFcfs: () => void;
  submitApplication: () => void;
  approveApplication: () => void;
  rejectApplication: () => void;
  resetApplication: () => void;
  ensureReferralCode: () => string;
  addReferral: () => boolean;
  resetReferrals: () => void;
  setMintEligible: (v: boolean) => void;
  setHasHydrated: (v: boolean) => void;
  resetAll: () => void;
};

const initialState: State = {
  walletConnected: false,
  walletAddress: null,
  twitterConnected: false,
  discordJoined: false,
  retweeted: false,
  tagged: false,
  tasksCompleted: false,
  fcfsApproved: false,
  applicationStatus: "none",
  referralCount: 0,
  referralLimit: REFERRAL_LIMIT,
  mintEligible: false,
  fcfsRemaining: FCFS_TOTAL,
  referralCode: null,
  _hasHydrated: false,
};

function computeMintEligible(s: Partial<State>) {
  return !!(s.fcfsApproved || s.applicationStatus === "approved");
}

function makeReferralCode() {
  return "SIM-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initialState,

      connectWallet: (addr) =>
        set({ walletConnected: true, walletAddress: addr }),

      disconnectWallet: () =>
        set({ walletConnected: false, walletAddress: null }),

      setTwitterConnected: (v) => set({ twitterConnected: v }),
      setDiscordJoined: (v) => set({ discordJoined: v }),
      setRetweeted: (v) => set({ retweeted: v }),
      setTagged: (v) => set({ tagged: v }),

      setTasksCompleted: (v) => set({ tasksCompleted: v }),

      tryGrantFcfs: () => {
        const s = get();
        if (s.fcfsApproved) return true;
        if (s.fcfsRemaining <= 0) return false;
        const next = {
          fcfsApproved: true,
          fcfsRemaining: s.fcfsRemaining - 1,
        };
        set({
          ...next,
          mintEligible: computeMintEligible({ ...s, ...next }),
        });
        return true;
      },

      decrementFcfs: () => {
        const s = get();
        if (s.fcfsRemaining > 0) set({ fcfsRemaining: s.fcfsRemaining - 1 });
      },

      submitApplication: () =>
        set((s) => {
          const next = { ...s, applicationStatus: "pending" as const };
          return {
            applicationStatus: "pending",
            mintEligible: computeMintEligible(next),
          };
        }),

      approveApplication: () =>
        set((s) => {
          const next = { ...s, applicationStatus: "approved" as const };
          return {
            applicationStatus: "approved",
            mintEligible: computeMintEligible(next),
          };
        }),

      rejectApplication: () =>
        set((s) => {
          const next = { ...s, applicationStatus: "rejected" as const };
          return {
            applicationStatus: "rejected",
            mintEligible: computeMintEligible(next),
          };
        }),

      resetApplication: () =>
        set((s) => {
          const next = { ...s, applicationStatus: "none" as const };
          return {
            applicationStatus: "none",
            mintEligible: computeMintEligible(next),
          };
        }),

      ensureReferralCode: () => {
        const s = get();
        if (s.referralCode) return s.referralCode;
        const code = makeReferralCode();
        set({ referralCode: code });
        return code;
      },

      addReferral: () => {
        const s = get();
        if (s.referralCount >= s.referralLimit) return false;
        set({ referralCount: s.referralCount + 1 });
        return true;
      },

      resetReferrals: () => set({ referralCount: 0 }),

      setMintEligible: (v) => set({ mintEligible: v }),

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      resetAll: () =>
        set({ ...initialState, _hasHydrated: get()._hasHydrated }),
    }),
    {
      name: "simian-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { _hasHydrated, ...rest } = s;
        return rest;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
