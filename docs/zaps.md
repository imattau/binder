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
