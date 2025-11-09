
import React from 'react';
import type { Platform, PlatformName } from './types';
import { YouTubeIcon, TikTokIcon, InstagramIcon, TwitterIcon, FacebookIcon, LinkedInIcon, PinterestIcon } from './components/icons/PlatformIcons';

export const PLATFORMS: Record<PlatformName, Platform> = {
    YouTube: {
        name: 'YouTube',
        color: '#FF0000',
        icon: <YouTubeIcon />,
        regex: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:\S+)/,
    },
    TikTok: {
        name: 'TikTok',
        color: '#000000',
        icon: <TikTokIcon />,
        regex: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/(?:@[\w.-]+\/video\/|v\/|embed\/|)([0-9]+)/,
    },
    Instagram: {
        name: 'Instagram',
        color: '#E4405F',
        icon: <InstagramIcon />,
        regex: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([\w-]+)/,
    },
    Twitter: {
        name: 'Twitter',
        color: '#1DA1F2',
        icon: <TwitterIcon />,
        regex: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(?:\w+)\/status\/(\d+)/,
    },
    Facebook: {
        name: 'Facebook',
        color: '#1877F2',
        icon: <FacebookIcon />,
        regex: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?:watch\/?\?v=|video\.php\?v=|)([\w.-]+)/,
    },
    LinkedIn: {
        name: 'LinkedIn',
        color: '#0A66C2',
        icon: <LinkedInIcon />,
        regex: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:feed\/update\/urn:li:activity:|embed\/feed\/update\/urn:li:share:|posts\/)/,
    },
    Pinterest: {
        name: 'Pinterest',
        color: '#E60023',
        icon: <PinterestIcon />,
        regex: /(?:https?:\/\/)?(?:www\.)?pinterest\.(?:com|ca|co\.uk|fr|de|es|it|jp|com\.au)\/pin\/(\d+)/,
    },
};
