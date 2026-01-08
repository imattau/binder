import type { Result } from '$lib/domain/result';
import { ok, fail } from '$lib/domain/result';

export const wsProbe = {
    async probe(url: string, timeoutMs = 2000): Promise<Result<number>> {
        return new Promise((resolve) => {
            const start = Date.now();
            let socket: WebSocket | null = null;
            
            try {
                socket = new WebSocket(url);
            } catch (e) {
                resolve(fail({ message: 'Invalid URL or construction failed', cause: e }));
                return;
            }

            const timeoutId = setTimeout(() => {
                socket?.close();
                resolve(fail({ message: 'Connection timed out' }));
            }, timeoutMs);

            socket.onopen = () => {
                const latency = Date.now() - start;
                clearTimeout(timeoutId);
                socket?.close();
                resolve(ok(latency));
            };

            socket.onerror = (err) => {
                clearTimeout(timeoutId);
                // WebSocket errors give no details in JS
                resolve(fail({ message: 'Connection failed', cause: err }));
            };
        });
    }
};
