"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ApplicationStatus = "none" | "pending" | "approved" | "rejected";

export const FCFS_TOTAL = 50;
export const REFERRAL_LIMIT = 5;

export type TaskFlags = { opened: boolean; completed: boolean };

export type State = {
  walletConnected: boolean;
  walletAddress: string | null;

  // New tasks model — keyed by task id (e.g. "follow", "retweet").
  taskState: Record<string, TaskFlags>;

  // Identity submitted via the tasks form.
  twitterHandle: string | null;
  submittedWallet: string | null;

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

  markTaskOpened: (id: string) => void;
  markTaskCompleted: (id: string) => void;
  resetTask: (id: string) => void;

  submitIdentity: (wallet: string, twitter: string) => void;
  clearIdentity: () => void;

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
  taskState: {},
  twitterHandle: null,
  submittedWallet: null,
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

      markTaskOpened: (id) =>
        set((s) => ({
          taskState: {
            ...s.taskState,
            [id]: { opened: true, completed: s.taskState[id]?.completed ?? false },
          },
        })),

      markTaskCompleted: (id) =>
        set((s) => ({
          taskState: {
            ...s.taskState,
            [id]: { opened: true, completed: true },
          },
        })),

      resetTask: (id) =>
        set((s) => {
          const next = { ...s.taskState };
          delete next[id];
          return { taskState: next };
        }),

      submitIdentity: (wallet, twitter) =>
        set({
          submittedWallet: wallet.toLowerCase(),
          twitterHandle: twitter.replace(/^@+/, "").trim(),
        }),

      clearIdentity: () => set({ submittedWallet: null, twitterHandle: null }),

      setTasksCompleted: (v) => set({ tasksCompleted: v }),

      tryGrantFcfs: () => {
        const s = get();
        if (s.fcfsApproved) return true;
        if (s.fcfsRemaining <= 0) return false;
        const next = { fcfsApproved: true, fcfsRemaining: s.fcfsRemaining - 1 };
        set({ ...next, mintEligible: computeMintEligible({ ...s, ...next }) });
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
      version: 2,
      migrate: (persisted, fromVersion) => {
        // v1 → v2: drop legacy per-task booleans, hydrate the new taskState
        // map from them so users mid-flow don't lose progress.
        if (fromVersion < 2 && persisted && typeof persisted === "object") {
          const p = persisted as Record<string, unknown>;
          const taskState: Record<string, TaskFlags> = (p.taskState as any) ?? {};
          const adopt = (id: string, prevKey: string) => {
            if (p[prevKey] === true && !taskState[id]) {
              taskState[id] = { opened: true, completed: true };
            }
          };
          adopt("follow", "twitterConnected");
          adopt("retweet", "retweeted");
          adopt("discord", "discordJoined");
          adopt("tag", "tagged");
          delete p.twitterConnected;
          delete p.retweeted;
          delete p.discordJoined;
          delete p.tagged;
          p.taskState = taskState;
        }
        return persisted as State;
      },
      partialize: (s) => {
        // Exclude application/eligibility status from persistence — server is
        // the source of truth, the client should fetch fresh on mount.
        const {
          _hasHydrated,
          applicationStatus,
          fcfsApproved,
          mintEligible,
          ...rest
        } = s;
        return rest;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
