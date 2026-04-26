export function normalizeWallet(addr: string): string {
  return addr.trim().toLowerCase();
}

export function isValidWallet(addr: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(addr.trim());
}
