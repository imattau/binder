# Zap (Lightning) Payments

Binder supports NIP-57 Zaps to allow users to tip authors and content directly.

## Supported Wallet Methods

1.  **WebLN**: If a WebLN compatible extension (like Alby) is detected (`window.webln`), Binder will attempt to pay the invoice automatically.
2.  **Invoice Fallback**: If WebLN is not available or fails, a Lightning Network invoice (BECH32) is displayed. Users can:
    *   Click "Open Wallet" to trigger their system's default Lightning handler.
    *   Copy the invoice string to paste into their wallet.

## Defaults and Limits

*   **Presets**: 21, 100, 500, 1,000, 5,000 sats.
*   **Default**: 100 sats (or user's last used amount).
*   **Minimum**: 1 sat (enforced by UI).
*   **Maximum**: 100,000 sats (enforced by UI range).
*   **Safety**: Amounts over 10,000 sats require an explicit confirmation step in the modal.

## Zap Flow

1.  **Resolution**: The app looks up the target's `lud16` (Lightning Address) from their Nostr profile (Kind 0).
2.  **Request**: A NIP-57 `zap request` (Kind 9734) event is created and signed by the user (via NIP-07).
3.  **Invoice**: The app sends the signed request to the target's callback URL to fetch a custom invoice.
4.  **Payment**: The invoice is presented for payment.
5.  **Receipt**: After payment, the Lightning Service Provider publishes a Zap Receipt (Kind 9735) which confirms the transaction.

## Receipt Detection

The application displays a "Zap Sent" success message immediately upon successful WebLN payment or manual completion. The social counts (Zap count) on the page are updated via the standard background relay subscriptions when the Kind 9735 receipt is propagated.

## Technical Details (AI-Ready)

### Nostr Kinds Used
- **Kind 9734**: Zap Request (signed by the user).
- **Kind 9735**: Zap Receipt (published by the Lightning Service Provider).
- **Kind 0**: Metadata (used to resolve `lud16` Lightning address).
- **Kind 30003**: Long-form Content (Book).
- **Kind 30023**: Long-form Content (Chapter).

### Tagging
Binder implements NIP-57 tagging conventions:
- `p` tag for the recipient pubkey.
- `a` tag for addressable events (Book/Chapter).
- `e` tag for specific event IDs (if available).
- `relays` tag containing the relays for the zap receipt.
