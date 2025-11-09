import type { MediaInfo, Platform, DownloadOption } from '../types';

// ──────────────────────────────────────────────────────────────────────
// YOUTUBE – Local Backend with ytdl-core + Public API Fallback
// ──────────────────────────────────────────────────────────────────────

/**
 * Fallback function to fetch YouTube info from a public Invidious API.
 * This is used if the local backend service is not available.
 */
const fetchYouTubeInfoFromInvidious = async (url: string): Promise<MediaInfo> => {
    const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
    if (!videoIdMatch) throw new Error('Invalid YouTube URL for fallback API');
    const videoId = videoIdMatch[1];
    
    // A list of public Invidious instances to try
    const invidiousInstances = [
      'https://vid.puffyan.us',
      'https://invidious.projectsegfau.lt',
      'https://invidious.kavin.rocks',
      'https://invidious.io.lol',
    ];

    for (const instance of invidiousInstances) {
        try {
            const apiUrl = `${instance}/api/v1/videos/${videoId}`;
            // Use a short timeout for each public API attempt
            const res = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
            if (!res.ok) continue; // Try next instance if this one fails
            
            const data = await res.json();
            
            if (!data.formatStreams || data.formatStreams.length === 0) continue;

            const downloadOptions: DownloadOption[] = data.formatStreams
                .filter((f: any) => f.url && f.qualityLabel)
                .map((f: any) => ({
                    quality: f.qualityLabel,
                    format: f.container || 'mp4',
                    url: f.url,
                    size: f.size ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : undefined,
                }));
                
            if (downloadOptions.length === 0) continue; // No downloadable formats

            return {
                title: data.title,
                thumbnail: data.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url || data.videoThumbnails?.[0]?.url,
                duration: new Date(data.lengthSeconds * 1000).toISOString().substr(11, 8),
                author: data.author,
                platform: 'YouTube',
                url,
                description: data.description,
                downloadOptions,
            };
        } catch (error) {
            console.warn(`[Invidious Fallback] Failed to fetch from ${instance}`, error);
            // Continue to the next instance
        }
    }
    
    throw new Error('The local service is down and all public YouTube APIs failed. Please try again later.');
};

/**
 * Main function to fetch YouTube info.
 * It first tries the local backend service for reliability and falls back to public APIs if needed.
 */
const fetchYouTubeInfo = async (url: string): Promise<MediaInfo> => {
    // The preferred method: a local backend service running on port 3001
    // that uses ytdl-core for robust fetching.
    const backendApi = `http://localhost:3001/api/youtube-info?url=${encodeURIComponent(url)}`;
    
    try {
        // Use a short timeout to quickly determine if the local service is available
        const res = await fetch(backendApi, { signal: AbortSignal.timeout(3000) });
        
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ 
                error: 'The backend service sent an invalid response.' 
            }));
            throw new Error(errorData.error || `⚠️ Backend service failed with status ${res.status}.`);
        }
        
        console.log("[YouTube] Fetched from local backend successfully.");
        const data: MediaInfo = await res.json();
        return data;
    } catch (err: any) {
        console.warn('[YouTube] Local backend failed, attempting public API fallback.', err.message);
        
        // Only trigger fallback on network errors, not on specific backend errors (like 400s)
        if (err.name === 'AbortError' || err.message.includes('Failed to fetch')) {
             console.log("[YouTube] Using public Invidious API as a fallback.");
             return await fetchYouTubeInfoFromInvidious(url);
        }

        // Re-throw specific, user-friendly errors from the backend (e.g., "Invalid YouTube link")
        throw new Error(err.message);
    }
};

// ──────────────────────────────────────────────────────────────────────
// TIKTOK – Already working, just cleaned up
// ──────────────────────────────────────────────────────────────────────
const fetchTikTokInfo = async (url: string): Promise<MediaInfo> => {
  const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
  const res = await fetch(api);
  if (!res.ok) throw new Error('TikTok API down');
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
};

// ──────────────────────────────────────────────────────────────────────
// TWITTER / X – vxtwitter (stable)
// ──────────────────────────────────────────────────────────────────────
const fetchTwitterInfo = async (url: string): Promise<MediaInfo> => {
  const api = url.replace(/^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)/, 'https://api.vxtwitter.com');
  const res = await fetch(api);
  if (!res.ok) throw new Error('Twitter API error');
  const json: any = await res.json();
  if (!json.tweet) throw new Error(json.message || 'Tweet not found');

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
};

// ──────────────────────────────────────────────────────────────────────
// INSTAGRAM – ddinstagram (most reliable free API)
// ──────────────────────────────────────────────────────────────────────
const fetchInstagramInfo = async (url: string): Promise<MediaInfo> => {
  const api = `https://ddinstagram.com/api/?url=${encodeURIComponent(url)}`;
  const res = await fetch(api);
  if (!res.ok) throw new Error('Instagram API error');
  const json: any = await res.json();
  if (!json.success) throw new Error(json.message || 'Instagram fetch failed');

  const d = json.data;
  const opts: DownloadOption[] = [];

  if (d.video_url) {
    opts.push({ quality: 'Video', format: 'mp4', url: d.video_url });
  }
  if (d.image_url) {
    opts.push({ quality: 'Image', format: 'jpg', url: d.image_url });
  }
  if (d.carousel) {
    d.carousel.forEach((item: any, i: number) => {
      if (item.video_url) {
        opts.push({ quality: `Slide ${i + 1} (Video)`, format: 'mp4', url: item.video_url });
      } else {
        opts.push({ quality: `Slide ${i + 1} (Image)`, format: 'jpg', url: item.image_url });
      }
    });
  }

  if (!opts.length) throw new Error('No media found');

  return {
    title: d.caption?.slice(0, 100) || 'Instagram Post',
    thumbnail: d.thumbnail || d.image_url,
    author: d.username,
    platform: 'Instagram',
    url,
    description: d.caption,
    downloadOptions: opts,
  };
};

// ──────────────────────────────────────────────────────────────────────
// FACEBOOK – fbdown (public reels/videos)
// ──────────────────────────────────────────────────────────────────────
const fetchFacebookInfo = async (url: string): Promise<MediaInfo> => {
  const api = `https://fbdownloader.org/api/?url=${encodeURIComponent(url)}`;
  const res = await fetch(api);
  if (!res.ok) throw new Error('Facebook API error');
  const json: any = await res.json();
  if (!json.success) throw new Error(json.message || 'Facebook fetch failed');

  const opts: DownloadOption[] = [];

  if (json.hd) opts.push({ quality: 'HD', format: 'mp4', url: json.hd });
  if (json.sd) opts.push({ quality: 'SD', format: 'mp4', url: json.sd });

  if (!opts.length) throw new Error('No video found (maybe private)');

  return {
    title: 'Facebook Video',
    thumbnail: json.thumbnail,
    author: 'Facebook User',
    platform: 'Facebook',
    url,
    description: '',
    downloadOptions: opts,
  };
};

// ──────────────────────────────────────────────────────────────────────
// PINTEREST – pinloader
// ──────────────────────────────────────────────────────────────────────
const fetchPinterestInfo = async (url: string): Promise<MediaInfo> => {
  const api = `https://pinloader.net/api/?url=${encodeURIComponent(url)}`;
  const res = await fetch(api);
  if (!res.ok) throw new Error('Pinterest API error');
  const json: any = await res.json();
  if (!json.success) throw new Error(json.message || 'Pinterest fetch failed');

  const opts: DownloadOption[] = [];

  if (json.video) {
    opts.push({ quality: 'Video', format: 'mp4', url: json.video });
  }
  if (json.image) {
    opts.push({ quality: 'Image', format: 'jpg', url: json.image });
  }

  if (!opts.length) throw new Error('No media found');

  return {
    title: json.title || 'Pinterest Pin',
    thumbnail: json.image || json.video,
    author: json.author || 'Unknown',
    platform: 'Pinterest',
    url,
    description: json.description,
    downloadOptions: opts,
  };
};

// ──────────────────────────────────────────────────────────────────────
// MAIN EXPORT – Now supports ALL platforms
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
        throw new Error('LinkedIn not supported (no public API)');
      default:
        throw new Error(`Platform ${platform.name} not supported yet`);
    }
  } catch (err: any) {
    console.error(`[fetchMediaInfo] ${platform.name}`, err);
    throw new Error(err.message || `Failed to fetch ${platform.name} media`);
  }
};