const ADMIN_STORAGE_KEY = 'binder_admin_pubkey';

const LOCAL_NETWORK_RE = /^(localhost|127\\.0\\.0\\.1|::1|10\\.|192\\.168\\.|172\\.(1[6-9]|2[0-9]|3[0-1]))$/;

export function isLocalNetworkHost(hostname?: string): boolean {
    if (!hostname) return false;
    return LOCAL_NETWORK_RE.test(hostname);
}

export function getStoredAdminPubkey(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ADMIN_STORAGE_KEY);
}

export function setStoredAdminPubkey(pubkey: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ADMIN_STORAGE_KEY, pubkey);
}

export function clearStoredAdminPubkey(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ADMIN_STORAGE_KEY);
}

export function ensureAdminAssignment(pubkey: string): boolean {
    const existing = getStoredAdminPubkey();
    if (existing) {
        return existing === pubkey;
    }

    // Allow the first user to claim admin regardless of hostname
    // This is crucial for remote VPS setups where the owner is the first to login
    setStoredAdminPubkey(pubkey);
    return true;
}
