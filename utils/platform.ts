
import { PLATFORMS } from '../constants';
import type { Platform } from '../types';

export const getPlatform = (url: string): Platform | null => {
    for (const platform of Object.values(PLATFORMS)) {
        if (platform.regex.test(url)) {
            return platform;
        }
    }
    return null;
};
