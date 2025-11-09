// FIX: Import `ReactElement` type to fix 'Cannot find namespace JSX' error.
import type { ReactElement } from 'react';

export type PlatformName = 'YouTube' | 'TikTok' | 'Instagram' | 'Twitter' | 'Facebook' | 'LinkedIn' | 'Pinterest';

export type DownloadQuality = string; // More flexible for various resolutions like '1080p 60fps', '360p', etc.

export interface Platform {
    name: PlatformName;
    color: string;
    // FIX: Use `ReactElement` type instead of `JSX.Element`.
    icon: ReactElement;
    regex: RegExp;
}

export interface DownloadOption {
    quality: DownloadQuality;
    url: string;
    format: string;
    size?: string;
}

export interface MediaInfo {
    title: string;
    thumbnail: string;
    duration?: string;
    author: string;
    platform: PlatformName;
    url: string; // The original source URL
    downloadOptions: DownloadOption[];
    description?: string;
}

export interface HistoryItem {
    id: string;
    title: string;
    thumbnail: string;
    platform: PlatformName;
    url: string;
    downloadedAt: string;
}