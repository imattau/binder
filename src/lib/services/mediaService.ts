import { BlossomClient } from 'blossom-client-sdk';
import { ok, fail, type Result } from '$lib/domain/result';
import { signerService } from './signerService';
import { mediaSettingsService, DEFAULT_MEDIA_SERVERS } from './mediaSettingsService';
import type { MediaServerSetting } from '$lib/infra/storage/dexieDb';

const MAX_IMAGE_DIMENSION = 1600;

export async function compressImage(file: File): Promise<Blob> {
    if (!file.type.startsWith('image/') || typeof window === 'undefined' || typeof createImageBitmap !== 'function') {
        return file;
    }

    const bitmap = await createImageBitmap(file);
    let width = bitmap.width;
    let height = bitmap.height;

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        bitmap.close();
        return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.8);
    });

    return blob ?? file;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to serialize image'));
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
}

export function dataUrlToBlob(dataUrl: string): Blob {
    const [, base64] = dataUrl.split(',');
    const mimeMatch = dataUrl.match(/data:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
}

async function uploadToStandard(serverUrl: string, payload: Blob): Promise<string> {
    const sha = await BlossomClient.getFileSha256(payload);
    const headers: Record<string, string> = {
        'X-SHA-256': sha,
        'X-Content-Length': String(payload.size)
    };

    if (payload.type) {
        headers['X-Content-Type'] = payload.type;
    }

    const uploadUrl = new URL('/upload', serverUrl);
    const response = await fetch(uploadUrl.toString(), {
        method: 'PUT',
        body: payload,
        headers
    });

    if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const descriptor = await response.json();
    if (!descriptor.url) {
        throw new Error('Upload response missing URL');
    }
    return descriptor.url;
}

async function performBlossomUpload(server: string, payload: Blob): Promise<string> {
    const sign = async (event: any) => {
        const res = await signerService.signEvent(event);
        if (res.ok) return res.value;
        throw new Error(res.error.message);
    };

    const client = new BlossomClient(server, sign);
    const authEvent = await client.createUploadAuth(payload, {
        servers: server,
        type: 'upload'
    });
    const blob = await client.uploadBlob(payload, { auth: authEvent });
    return blob.url;
}

async function resolveMediaServer(override?: string): Promise<MediaServerSetting> {
    if (override) {
        return { url: override, enabled: true, provider: 'standard' };
    }

    const res = await mediaSettingsService.getMediaServers();
    if (!res.ok || res.value.length === 0) {
        return DEFAULT_MEDIA_SERVERS[0];
    }

    const enabled = res.value.filter(server => server.enabled);
    if (enabled.length > 0) {
        return enabled[0];
    }

    return res.value[0];
}

async function uploadBlobToMedia(
    cover: Blob | File,
    serverUrl?: string,
    options?: { allowInlineFallback?: boolean }
): Promise<Result<string>> {
    const payload = cover instanceof File ? await compressImage(cover) : cover;
    const target = await resolveMediaServer(serverUrl);

    try {
        const url =
            target.provider === 'blossom'
                ? await performBlossomUpload(target.url, payload)
                : await uploadToStandard(target.url, payload);

        return ok(url);
    } catch (e: any) {
        const rawMessage = typeof e?.message === 'string' ? e.message : String(e);
        const normalized = rawMessage.toLowerCase();
        const needsFallback =
            normalized.includes('failed to fetch') ||
            normalized.includes('cors') ||
            normalized.includes('access-control-allow-origin') ||
            normalized.includes('net::err_failed');

        if (needsFallback && options?.allowInlineFallback) {
            console.warn('Media upload blocked by CORS, falling back to inline data URL');
            const localUrl = await blobToDataUrl(payload);
            return ok(localUrl);
        }
        if (needsFallback) {
            return fail({
                message:
                    'Upload blocked (CORS/blocked relay). Please enable a CORS-friendly media server or try again later.'
            });
        }

        return fail({ message: 'Upload failed: ' + rawMessage });
    }
}

export const mediaService = {
    uploadCover: (file: Blob | File) => uploadBlobToMedia(file, undefined, { allowInlineFallback: true }),
    uploadImage: (file: Blob | File) => uploadBlobToMedia(file)
};
