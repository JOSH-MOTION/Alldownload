import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: '❌ URL parameter is required' });
    }

    // Validate YouTube URL
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:\S+)/;
    if (!youtubeRegex.test(url)) {
        return res.status(400).json({ error: '❌ Invalid YouTube URL' });
    }

    try {
        // Extract video ID
        const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
        if (!videoIdMatch) {
            return res.status(400).json({ error: '❌ Could not extract video ID' });
        }
        const videoId = videoIdMatch[1];

        // Use YouTube's oEmbed API for basic info
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const oembedRes = await fetch(oembedUrl);
        
        if (!oembedRes.ok) {
            throw new Error('Video not found or unavailable');
        }
        
        const oembedData = await oembedRes.json();

        // Use Invidious API for download links
        const invidiousInstances = [
            'https://vid.puffyan.us',
            'https://invidious.projectsegfau.lt',
            'https://inv.nadeko.net',
            'https://invidious.privacyredirect.com',
        ];

        let videoData = null;
        
        for (const instance of invidiousInstances) {
            try {
                const apiUrl = `${instance}/api/v1/videos/${videoId}`;
                const response = await fetch(apiUrl, { 
                    signal: AbortSignal.timeout(5000),
                    headers: { 'Accept': 'application/json' }
                });
                
                if (!response.ok) continue;
                
                const data = await response.json();
                
                if (data.formatStreams && data.formatStreams.length > 0) {
                    videoData = data;
                    break;
                }
            } catch (err) {
                console.warn(`Failed to fetch from ${instance}`);
                continue;
            }
        }

        if (!videoData) {
            // Fallback: return basic info with direct YouTube links
            return res.status(200).json({
                title: oembedData.title,
                thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                duration: 'N/A',
                author: oembedData.author_name,
                platform: 'YouTube',
                url: `https://www.youtube.com/watch?v=${videoId}`,
                description: `Watch on YouTube`,
                downloadOptions: [
                    {
                        quality: 'Watch on YouTube',
                        format: 'link',
                        url: `https://www.youtube.com/watch?v=${videoId}`,
                    }
                ],
            });
        }

        // Parse download options
        const downloadOptions = [];

        // Add video+audio streams
        if (videoData.formatStreams) {
            videoData.formatStreams
                .filter((f: any) => f.url && f.qualityLabel)
                .forEach((format: any) => {
                    downloadOptions.push({
                        quality: format.qualityLabel,
                        format: format.container || 'mp4',
                        url: format.url,
                        size: format.size ? `${(format.size / 1024 / 1024).toFixed(1)} MB` : undefined,
                    });
                });
        }

        // Add audio-only
        if (videoData.adaptiveFormats) {
            const audioFormats = videoData.adaptiveFormats.filter((f: any) => 
                f.type && f.type.includes('audio')
            );
            
            if (audioFormats.length > 0) {
                const bestAudio = audioFormats.sort((a: any, b: any) => 
                    (b.bitrate || 0) - (a.bitrate || 0)
                )[0];
                
                downloadOptions.push({
                    quality: 'audio only',
                    format: 'm4a',
                    url: bestAudio.url,
                    size: bestAudio.size ? `${(bestAudio.size / 1024 / 1024).toFixed(1)} MB` : undefined,
                });
            }
        }

        // Remove duplicates and sort
        const uniqueOptions = Array.from(
            new Map(downloadOptions.map(item => [item.quality, item])).values()
        );

        uniqueOptions.sort((a, b) => {
            const getScore = (quality: string) => {
                if (quality.includes('audio only')) return 0;
                const res = parseInt(quality);
                return isNaN(res) ? 1 : res;
            };
            return getScore(b.quality) - getScore(a.quality);
        });

        const mediaInfo = {
            title: videoData.title || oembedData.title,
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            duration: videoData.lengthSeconds 
                ? new Date(videoData.lengthSeconds * 1000).toISOString().substr(11, 8)
                : 'N/A',
            author: videoData.author || oembedData.author_name,
            platform: 'YouTube',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            description: videoData.description?.slice(0, 500) || '',
            downloadOptions: uniqueOptions.length > 0 ? uniqueOptions : [{
                quality: 'Watch on YouTube',
                format: 'link',
                url: `https://www.youtube.com/watch?v=${videoId}`,
            }],
        };

        return res.status(200).json(mediaInfo);

    } catch (error: any) {
        console.error('[YouTube API Error]:', error.message);
        return res.status(500).json({ 
            error: '🔒 Failed to fetch video. It may be private, age-restricted, or unavailable.' 
        });
    }
}