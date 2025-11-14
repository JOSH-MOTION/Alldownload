import type { MediaInfo, Platform, DownloadOption } from '../types';

// Detect if running on Vercel or localhost
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : ''; // Empty string for Vercel (same domain)

// ──────────────────────────────────────────────────────────────────────
// YOUTUBE – Uses Vercel Serverless Function
// ──────────────────────────────────────────────────────────────────────

const fetchYouTubeInfo = async (url: string): Promise<MediaInfo> => {
    const apiUrl = `${API_BASE_URL}/api/youtube-info?url=${encodeURIComponent(url)}`;
    
    try {
        const res = await fetch(apiUrl, { 
            signal: AbortSignal.timeout(15000),
            headers: {
                'Accept': 'application/json',
            }
        });
        
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ 
                error: 'API service error' 
            }));
            throw new Error(errorData.error || `Failed with status ${res.status}`);
        }
        
        const data: MediaInfo = await res.json();
        return data;
    } catch (err: any) {
        if (err.name === 'AbortError') {
            throw new Error('⚠️ Request timeout. YouTube is taking too long to respond.');
        }
        throw new Error(err.message || 'Failed to fetch YouTube video');
    }
};

// ──────────────────────────────────────────────────────────────────────
// TIKTOK – tikwm.com API
// ──────────────────────────────────────────────────────────────────────
const fetchTikTokInfo = async (url: string): Promise<MediaInfo> => {
  try {
    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const res = await fetch(api, { signal: AbortSignal.timeout(10000) });
    
    if (!res.ok) throw new Error('TikTok API unavailable');
    
    const json: any = await res.json();
    if (json.code !== 0) throw new Error(json.msg || 'TikTok fetch failed');

    const d = json.data;
    const opts: DownloadOption[] = [];

    const videoUrl = d.hdplay || d.play;
    if (videoUrl) {
      opts.push({
        quality: 'HD Video',
        format: 'mp4',
        url: videoUrl,
        size: d.size ? `${(d.size / 1024 / 1024).toFixed(1)} MB` : undefined,
      });
    }

    if (d.music) {
      const musicUrl = d.music.startsWith('http') ? d.music : `https://www.tikwm.com${d.music}`;
      opts.push({ quality: 'Audio', format: 'mp3', url: musicUrl });
    }

    if (!opts.length) throw new Error('No media found');

    return {
      title: d.title || 'TikTok Video',
      thumbnail: d.cover,
      duration: d.duration ? new Date(d.duration * 1000).toISOString().substr(14, 5) : '00:00',
      author: d.author?.nickname || 'Unknown',
      platform: 'TikTok',
      url,
      description: d.title,
      downloadOptions: opts,
    };
  } catch (err: any) {
    throw new Error(err.message || 'Failed to fetch TikTok video');
  }
};

// ──────────────────────────────────────────────────────────────────────
// TWITTER / X – vxtwitter API
// ──────────────────────────────────────────────────────────────────────
const fetchTwitterInfo = async (url: string): Promise<MediaInfo> => {
  try {
    const api = url.replace(/^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)/, 'https://api.vxtwitter.com');
    const res = await fetch(api, { signal: AbortSignal.timeout(8000) });
    
    if (!res.ok) throw new Error('vxtwitter unavailable');
    
    const json: any = await res.json();
    if (!json.tweet) throw new Error('Tweet not found');

    const t = json.tweet;
    const media = t.media?.all || [];
    const opts: DownloadOption[] = [];

    media.forEach((m: any) => {
      if (m.type === 'video' || m.type === 'gif') {
        opts.push({
          quality: m.height ? `${m.height}p` : 'Video',
          format: m.url.split('.').pop() || 'mp4',
          url: m.url,
        });
      } else if (m.type === 'photo') {
        opts.push({
          quality: 'Photo',
          format: m.url.split('.').pop() || 'jpg',
          url: m.url,
        });
      }
    });

    if (!opts.length) throw new Error('No media in tweet');

    return {
      title: (t.text || '').slice(0, 100) + '...',
      thumbnail: media[0]?.thumbnail_url || media[0]?.url,
      author: t.user_name || t.user_screen_name,
      platform: 'Twitter',
      url: t.tweetURL || url,
      description: t.text,
      downloadOptions: opts,
    };
  } catch (err: any) {
    throw new Error('Failed to fetch Twitter/X post. The API may be temporarily unavailable.');
  }
};

// ──────────────────────────────────────────────────────────────────────
// INSTAGRAM – Multiple API attempts
// ──────────────────────────────────────────────────────────────────────
const fetchInstagramInfo = async (url: string): Promise<MediaInfo> => {
  const apis = [
    `https://api.saveig.app/api/download?url=${encodeURIComponent(url)}`,
    `https://v3.saveig.app/api/download?url=${encodeURIComponent(url)}`,
  ];

  for (const api of apis) {
    try {
      const res = await fetch(api, { 
        signal: AbortSignal.timeout(8000),
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!res.ok) continue;
      
      const json: any = await res.json();
      
      if (!json.data) continue;

      const d = json.data;
      const opts: DownloadOption[] = [];

      if (Array.isArray(d)) {
        d.forEach((item: any, i: number) => {
          if (item.url) {
            const isVideo = item.type === 'video' || item.url.includes('.mp4');
            opts.push({
              quality: d.length > 1 ? `Item ${i + 1} (${isVideo ? 'Video' : 'Image'})` : (isVideo ? 'Video' : 'Image'),
              format: isVideo ? 'mp4' : 'jpg',
              url: item.url,
            });
          }
        });
      } else {
        if (d.url) {
          opts.push({ 
            quality: 'Media', 
            format: d.url.includes('.mp4') ? 'mp4' : 'jpg', 
            url: d.url 
          });
        }
      }

      if (opts.length === 0) continue;

      return {
        title: d.title || d.caption?.slice(0, 100) || 'Instagram Post',
        thumbnail: d.thumbnail || opts[0].url,
        author: d.username || 'Instagram User',
        platform: 'Instagram',
        url,
        description: d.caption || '',
        downloadOptions: opts,
      };
    } catch (err) {
      console.warn(`Instagram API attempt failed:`, err);
      continue;
    }
  }
  
  throw new Error('Failed to fetch Instagram media. The post may be private or all APIs are unavailable.');
};

// ──────────────────────────────────────────────────────────────────────
// FACEBOOK – Basic support
// ──────────────────────────────────────────────────────────────────────
const fetchFacebookInfo = async (url: string): Promise<MediaInfo> => {
  throw new Error('Facebook downloads are currently unavailable. Most videos are private or require authentication.');
};

// ──────────────────────────────────────────────────────────────────────
// PINTEREST – Basic support
// ──────────────────────────────────────────────────────────────────────
const fetchPinterestInfo = async (url: string): Promise<MediaInfo> => {
  throw new Error('Pinterest downloads are currently unavailable.');
};

// ──────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ──────────────────────────────────────────────────────────────────────
export const fetchMediaInfo = async (url: string, platform: Platform): Promise<MediaInfo> => {
  try {
    switch (platform.name) {
      case 'YouTube':    return await fetchYouTubeInfo(url);
      case 'TikTok':     return await fetchTikTokInfo(url);
      case 'Twitter':    return await fetchTwitterInfo(url);
      case 'Instagram':  return await fetchInstagramInfo(url);
      case 'Facebook':   return await fetchFacebookInfo(url);
      case 'Pinterest':  return await fetchPinterestInfo(url);
      case 'LinkedIn':
        throw new Error('LinkedIn downloads are not supported (no public API available)');
      default:
        throw new Error(`Platform ${platform.name} is not supported yet`);
    }
  } catch (err: any) {
    console.error(`[fetchMediaInfo] ${platform.name}:`, err);
    throw new Error(err.message || `Failed to fetch ${platform.name} media. Please try again.`);
  }
}