"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ApplicationStatus = "none" | "pending" | "approved" | "rejected";

export type TaskFlags = { opened: boolean; completed: boolean };

export type State = {
  // New tasks model — keyed by task id (e.g. "follow", "retweet").
  taskState: Record<string, TaskFlags>;

  // The user's manually-entered identity. Set by submitIdentity from
  // either the tasks page form or the apply form. Acts as the canonical
  // "current wallet" across the site now that the auto-connect wallet
  // system has been removed.
  twitterHandle: string | null;
  submittedWallet: string | null;

  tasksCompleted: boolean;
  applicationStatus: ApplicationStatus;
  _hasHydrated: boolean;
};

export type Actions = {
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

  setHasHydrated: (v: boolean) => void;
  resetAll: () => void;
};

const initialState: State = {
  taskState: {},
  twitterHandle: null,
  submittedWallet: null,
  tasksCompleted: false,
  applicationStatus: "none",
  _hasHydrated: false,
};

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initialState,

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

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      resetAll: () =>
        set({ ...initialState, _hasHydrated: get()._hasHydrated }),
    }),
    {
      name: "simian-store",
      storage: createJSONStorage(() => localStorage),
      // v6 strips wallet-connect state (walletConnected, walletAddress)
      // — auto-connect was removed; submittedWallet is now the canonical
      // user-entered identity. v5 stripped auto-tracked referral fields.
      // v4 dropped FCFS fields. v3 dropped mintEligible. v2 migrated
      // per-task booleans into taskState.
      version: 6,
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

        if (fromVersion < 5) {
          delete p.referralCount;
          delete p.referralLimit;
          delete p.referralCode;
        }

        if (fromVersion < 6) {
          delete p.walletConnected;
          delete p.walletAddress;
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
      // CRITICAL: zustand's localStorage adapter is synchronous, so
      // without this the store reads from localStorage during module
      // load — BEFORE React's first render — and the client renders
      // different content than the SSR'd HTML, throwing React errors
      // #418/#423/#425. With skipHydration: true the store stays at
      // initialState until something explicitly calls rehydrate(); we
      // do that in <StoreHydration /> mounted in app/layout.tsx, after
      // mount, so SSR + first client render both see defaults.
      skipHydration: true,
    }
  )
);
