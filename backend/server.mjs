import express from 'express';
import cors from 'cors';
import ytdl from 'ytdl-core';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
// FIX: The express.json() middleware was causing a TypeScript overload error when used with a specific path. Applying it globally resolves the type ambiguity.
app.use(express.json());

// A simple in-memory cache to avoid hitting YouTube for the same URL repeatedly
const cache = new Map();

app.get('/api/youtube-info', async (req, res) => {
    const { url } = req.query;

    if (!url || !ytdl.validateURL(url)) {
        return res.status(400).json({ error: '❌ Invalid YouTube link' });
    }
    
    const videoId = ytdl.getVideoID(url);
    if(cache.has(videoId)) {
        console.log(`[Cache] HIT for ${videoId}`);
        return res.json(cache.get(videoId));
    }
    console.log(`[Cache] MISS for ${videoId}`);

    try {
        const info = await ytdl.getInfo(url);
        const { videoDetails } = info;

        const formats = info.formats;
        const downloadOptions = [];

        // Add video with audio streams (up to 720p usually)
        ytdl.filterFormats(formats, 'videoandaudio')
            .filter(f => f.container === 'mp4' && f.qualityLabel)
            .forEach(format => {
                downloadOptions.push({
                    quality: format.qualityLabel,
                    format: 'mp4',
                    url: format.url,
                    size: format.contentLength ? `${(Number(format.contentLength) / 1024 / 1024).toFixed(1)} MB` : undefined,
                });
            });

        // Add high quality video-only streams (1080p and above)
        ytdl.filterFormats(formats, 'videoonly')
            .filter(f => f.container === 'mp4' && f.qualityLabel)
            .forEach(format => {
                downloadOptions.push({
                    quality: `${format.qualityLabel} (no audio)`,
                    format: 'mp4',
                    url: format.url,
                    size: format.contentLength ? `${(Number(format.contentLength) / 1024 / 1024).toFixed(1)} MB` : undefined,
                });
            });
            
        // Add best audio stream
        const audioFormats = ytdl.filterFormats(formats, 'audioonly');
        if (audioFormats.length > 0) {
            const bestAudio = audioFormats.sort((a,b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
            downloadOptions.push({
                quality: 'audio only',
                format: bestAudio.container === 'mp4' ? 'm4a' : bestAudio.container,
                url: bestAudio.url,
                size: bestAudio.contentLength ? `${(Number(bestAudio.contentLength) / 1024 / 1024).toFixed(1)} MB` : undefined,
            });
        }
        
        // Remove duplicate qualities, keeping the first one encountered (which will be video+audio if available)
        const uniqueOptions = Array.from(new Map(downloadOptions.map(item => [item.quality, item])).values());
        
        // Custom sort order to prioritize higher resolutions with audio
        uniqueOptions.sort((a, b) => {
            const getScore = (quality) => {
                if (quality.includes('audio only')) return 0;
                const res = parseInt(quality);
                if (isNaN(res)) return 1; // Put non-standard qualities at the bottom
                // Give a large score bonus to formats that include audio
                const audioBonus = quality.includes('no audio') ? 0 : 10000;
                return res + audioBonus;
            };
            return getScore(b.quality) - getScore(a.quality);
        });

        const mediaInfo = {
            title: videoDetails.title,
            thumbnail: videoDetails.thumbnails[videoDetails.thumbnails.length - 1].url,
            duration: new Date(parseInt(videoDetails.lengthSeconds) * 1000).toISOString().substr(11, 8),
            author: videoDetails.author.name,
            platform: 'YouTube',
            url: videoDetails.video_url,
            description: videoDetails.description?.slice(0, 500) || '',
            downloadOptions: uniqueOptions,
        };
        
        // Cache the result for 1 hour to reduce redundant requests to YouTube
        cache.set(videoId, mediaInfo);
        setTimeout(() => cache.delete(videoId), 60 * 60 * 1000);

        res.json(mediaInfo);
    } catch (error) {
        console.error(`[ytdl-core] Failed to fetch info for ${url}`, error.message);
        res.status(500).json({ error: '🔒 This content might be private, age-restricted, or otherwise unavailable.' });
    }
});

app.listen(port, () => {
    console.log(`✅ Backend server with ytdl-core listening at http://localhost:${port}`);
});