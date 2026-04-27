"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ApplicationStatus = "none" | "pending" | "approved" | "rejected";

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
  applicationStatus: ApplicationStatus;
  referralCount: number;
  referralLimit: number;
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

  submitApplication: () => void;
  approveApplication: () => void;
  rejectApplication: () => void;
  resetApplication: () => void;

  ensureReferralCode: () => string;
  addReferral: () => boolean;
  resetReferrals: () => void;

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
  applicationStatus: "none",
  referralCount: 0,
  referralLimit: REFERRAL_LIMIT,
  referralCode: null,
  _hasHydrated: false,
};

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

      submitApplication: () => set({ applicationStatus: "pending" }),
      approveApplication: () => set({ applicationStatus: "approved" }),
      rejectApplication:  () => set({ applicationStatus: "rejected" }),
      resetApplication:   () => set({ applicationStatus: "none" }),

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

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      resetAll: () =>
        set({ ...initialState, _hasHydrated: get()._hasHydrated }),
    }),
    {
      name: "simian-store",
      storage: createJSONStorage(() => localStorage),
      // v4 strips FCFS-related fields. v3 dropped mintEligible. v2
      // migrated legacy per-task booleans into the taskState map.
      version: 4,
      migrate: (persisted, fromVersion) => {
        if (!persisted || typeof persisted !== "object") return persisted as State;
        const p = persisted as Record<string, unknown>;

        if (fromVersion < 2) {
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

        if (fromVersion < 3) {
          delete p.mintEligible;
        }

        if (fromVersion < 4) {
          delete p.fcfsApproved;
          delete p.fcfsRemaining;
        }

        return p as unknown as State;
      },
      partialize: (s) => {
        // Exclude application status from persistence — server is the
        // source of truth, the client should fetch fresh on mount.
        const {
          _hasHydrated,
          applicationStatus,
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
