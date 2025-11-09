import type { MediaInfo, Platform, DownloadOption } from '../types';

// ──────────────────────────────────────────────────────────────────────
// YOUTUBE – Multiple Invidious Mirrors + yt-dlp-style fallback
// ──────────────────────────────────────────────────────────────────────
const INV_MIRRORS = [
  'https://invidious.snopyta.org',
  'https://y.com.sb',
  'https://inv.riverside.rocks',
  'https://invidious.fdn.fr',
  'https://invidious.tiekoetter.com',
];

const getYoutubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

const fetchYouTubeInfo = async (url: string): Promise<MediaInfo> => {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) throw new Error('Invalid YouTube URL');

  let data: any = null;
  for (const base of INV_MIRRORS) {
    try {
      const api = `${base}/api/v1/videos/${videoId}?fields=title,videoThumbnails,author,description,lengthSeconds,formatStreams,adaptiveFormats`;
      const res = await fetch(api, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        data = await res.json();
        break;
      }
    } catch (_) { /* try next */ }
  }

  if (!data) throw new Error('All YouTube mirrors failed. Try again later.');

  const streams: any[] = [...(data.formatStreams || []), ...(data.adaptiveFormats || [])];
  const videoStreams = streams.filter(s => s.type?.includes('video/mp4') && s.qualityLabel);
  const audioStreams = streams.filter(s => s.type?.includes('audio'));
  const bestAudio = audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

  const options: DownloadOption[] = videoStreams.map((s: any) => ({
    quality: s.qualityLabel || `${s.height}p`,
    format: 'mp4',
    url: s.url,
    size: s.contentLength ? `${(Number(s.contentLength) / 1024 / 1024).toFixed(1)} MB` : undefined,
  }));

  if (bestAudio) {
    options.push({
      quality: 'audio',
      format: 'm4a',
      url: bestAudio.url,
      size: bestAudio.contentLength ? `${(Number(bestAudio.contentLength) / 1024 / 1024).toFixed(1)} MB` : undefined,
    });
  }

  if (options.length === 0) throw new Error('No downloadable streams (private/live?)');

  options.sort((a, b) => {
    const order = ['2160p','1440p','1080p','720p','480p','360p','240p','144p','audio'];
    return order.indexOf(a.quality) - order.indexOf(b.quality);
  });

  return {
    title: data.title || 'YouTube Video',
    thumbnail: data.videoThumbnails?.find((t: any) => t.quality === 'maxresdefault')?.url || data.videoThumbnails?.[0]?.url,
    duration: data.lengthSeconds ? new Date(data.lengthSeconds * 1000).toISOString().substr(11, 8) : 'LIVE',
    author: data.author,
    platform: 'YouTube',
    url: `https://youtube.com/watch?v=${videoId}`,
    description: data.description?.slice(0, 500),
    downloadOptions: options,
  };
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