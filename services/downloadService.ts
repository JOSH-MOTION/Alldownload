import type { MediaInfo, Platform, DownloadOption } from '../types';

/* --------------------------------------------------------------------- */
/*                           YOUTUBE (Invidious)                         */
/* --------------------------------------------------------------------- */
const INV_MIRRORS = [
  'https://invidious.io.lol',
  'https://invidious.snopyta.org',
  'https://y.com.sb',
  'https://inv.riverside.rocks',
  'https://invidious.fdn.fr',
];

/** Pick a random working mirror (simple round-robin with retry) */
async function getInvidiousUrl(path: string): Promise<string> {
  for (const base of INV_MIRRORS) {
    try {
      const url = `${base}${path}`;
      const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (r.ok) return url;
    } catch (_) {
      /* ignore */
    }
  }
  throw new Error('All Invidious mirrors are down');
}

const getYoutubeVideoId = (url: string): string | null => {
  const regex =
    /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const m = url.match(regex);
  return m ? m[1] : null;
};

const fetchYouTubeInfo = async (url: string): Promise<MediaInfo> => {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) throw new Error('Invalid YouTube URL');

  const apiUrl = await getInvidiousUrl(`/api/v1/videos/${videoId}`);
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`Invidious error: ${res.statusText}`);

  const data = await res.json();

  // ---- VIDEO ----
  const videoStreams = (data.adaptiveFormats ?? [])
    .filter((s: any) => s.type?.includes('video/mp4') && s.qualityLabel)
    .map((s: any) => ({
      quality: s.qualityLabel,
      url: s.url,
      size: s.contentLength ? Number(s.contentLength) : undefined,
    }));

  // ---- AUDIO ----
  const audioStreams = (data.adaptiveFormats ?? [])
    .filter((s: any) => s.type?.includes('audio'))
    .map((s: any) => ({
      bitrate: s.bitrate ?? 0,
      url: s.url,
      size: s.contentLength ? Number(s.contentLength) : undefined,
    }));

  const bestAudio = audioStreams.sort((a, b) => b.bitrate - a.bitrate)[0];

  // ---- BUILD OPTIONS ----
  const downloadOptions: DownloadOption[] = videoStreams.map((s) => ({
    quality: s.quality,
    format: 'mp4',
    url: s.url,
    size: s.size ? `${(s.size / 1024 / 1024).toFixed(2)} MB` : undefined,
  }));

  if (bestAudio) {
    downloadOptions.push({
      quality: 'audio',
      format: 'm4a',
      url: bestAudio.url,
      size: bestAudio.size ? `${(bestAudio.size / 1024 / 1024).toFixed(2)} MB` : undefined,
    });
  }

  if (!downloadOptions.length) throw new Error('No streams found (private / live?)');

  const qualityOrder = ['2160p','1440p','1080p','720p','480p','360p','240p','144p','audio'];
  downloadOptions.sort((a, b) => {
    const ia = qualityOrder.indexOf(a.quality);
    const ib = qualityOrder.indexOf(b.quality);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return {
    title: data.title ?? 'Untitled',
    thumbnail:
      data.videoThumbnails?.find((t: any) => t.quality === 'maxresdefault')?.url ??
      data.videoThumbnails?.[0]?.url,
    duration: new Date((data.lengthSeconds ?? 0) * 1000)
      .toISOString()
      .substr(11, 8),
    author: data.author,
    platform: 'YouTube',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    description: data.description,
    downloadOptions,
  };
};

/* --------------------------------------------------------------------- */
/*                               TIKTOK (tikwm)                          */
/* --------------------------------------------------------------------- */
const TIKTOK_API = 'https://www.tikwm.com/api/';

const fetchTikTokInfo = async (url: string): Promise<MediaInfo> => {
  const apiUrl = `${TIKTOK_API}?url=${encodeURIComponent(url)}&hd=1`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`TikTok API error: ${res.statusText}`);

  const json: any = await res.json();
  if (json.code !== 0) throw new Error(json.msg ?? 'TikTok fetch failed');

  const d = json.data;
  const opts: DownloadOption[] = [];

  // Prefer no-watermark video
  const videoUrl = d.hdplay ?? d.play ?? d.wmplay;
  if (videoUrl) {
    const sizeMB = d.size ? (d.size / 1024 / 1024).toFixed(2) + ' MB' : undefined;
    opts.push({ quality: 'HD Video', format: 'mp4', url: videoUrl, size: sizeMB });
  }

  // Audio (sometimes relative)
  if (d.music) {
    const musicUrl = d.music.startsWith('http') ? d.music : `https://www.tikwm.com${d.music}`;
    opts.push({ quality: 'Audio', format: 'mp3', url: musicUrl });
  }

  if (!opts.length) throw new Error('No downloadable media on this TikTok');

  return {
    title: d.title || 'TikTok Video',
    thumbnail: d.cover,
    duration: new Date((d.duration ?? 0) * 1000)
      .toISOString()
      .substr(14, 5),
    author: d.author?.nickname ?? 'Unknown',
    platform: 'TikTok',
    url,
    description: d.title,
    downloadOptions: opts,
  };
};

/* --------------------------------------------------------------------- */
/*                              TWITTER / X (vxtwitter)                 */
/* --------------------------------------------------------------------- */
const fetchTwitterInfo = async (url: string): Promise<MediaInfo> => {
  // vxtwitter is more reliable than fxtwitter at the moment
  const apiUrl = url
    .replace(/^https?:\/\/(www\.)?twitter\.com/, 'https://api.vxtwitter.com')
    .replace(/^https?:\/\/(www\.)?x\.com/, 'https://api.vxtwitter.com');

  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`vxtwitter error: ${res.statusText}`);

  const json: any = await res.json();
  if (!json.tweet) throw new Error(json.message ?? 'Tweet not found');

  const t = json.tweet;
  const media = t.media?.all ?? []; // new shape
  const opts: DownloadOption[] = [];

  media.forEach((m: any) => {
    if (m.type === 'video' || m.type === 'gif') {
      opts.push({
        quality: `${m.height}p`,
        format: m.url.split('.').pop() ?? 'mp4',
        url: m.url,
      });
    } else if (m.type === 'photo') {
      opts.push({
        quality: 'Image',
        format: m.url.split('.').pop() ?? 'jpg',
        url: m.url,
      });
    }
  });

  if (!opts.length) throw new Error('No media in this tweet');

  return {
    title: t.text?.slice(0, 80) + (t.text?.length > 80 ? '...' : ''),
    thumbnail: media[0]?.thumbnail_url ?? media[0]?.url,
    author: t.user_name ?? t.user_screen_name,
    platform: 'Twitter',
    url: t.tweetURL,
    description: t.text,
    downloadOptions: opts,
  };
};

/* --------------------------------------------------------------------- */
/*                               MAIN EXPORT                              */
/* --------------------------------------------------------------------- */
export const fetchMediaInfo = async (url: string, platform: Platform): Promise<MediaInfo> => {
  try {
    switch (platform.name) {
      case 'YouTube':
        return await fetchYouTubeInfo(url);
      case 'TikTok':
        return await fetchTikTokInfo(url);
      case 'Twitter':
        return await fetchTwitterInfo(url);
      case 'Instagram':
      case 'Facebook':
      case 'LinkedIn':
      case 'Pinterest':
        throw new Error(`Support for ${platform.name} is coming soon!`);
      default:
        throw new Error(`Unsupported platform: ${platform.name}`);
    }
  } catch (err) {
    console.error(`[fetchMediaInfo] ${platform.name}`, err);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(msg.includes('coming soon') ? msg : `Failed to fetch ${platform.name} media`);
  }
};