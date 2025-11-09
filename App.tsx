import React, { useState, useCallback } from 'react';
import { UrlInputForm } from './components/UrlInputForm';
import { MediaPreview } from './components/MediaPreview';
import { HistoryList } from './components/HistoryList';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import { useLocalStorage } from './hooks/useLocalStorage';
import { getPlatform } from './utils/platform';
import { fetchMediaInfo } from './services/downloadService';
import { generateSummary } from './services/ai/gemini';
import type { MediaInfo, HistoryItem, Platform, DownloadOption } from './types';
import { PLATFORMS } from './constants';

const App: React.FC = () => {
    const [theme, setTheme] = useTheme();
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [history, setHistory] = useLocalStorage<HistoryItem[]>('downloadHistory', []);

    const handleFetch = useCallback(async () => {
        if (!url) {
            setError('Please enter a URL.');
            return;
        }
        setError(null);
        setMediaInfo(null);
        setAiSummary(null);
        setIsLoading(true);

        const platform = getPlatform(url);
        if (!platform) {
            setError("Unsupported platform or invalid URL. Please try a link from YouTube, TikTok, Instagram, etc.");
            setIsLoading(false);
            return;
        }

        try {
            const data = await fetchMediaInfo(url, platform);
            setMediaInfo(data);
            
            // Generate AI summary after fetching media info
            const summary = await generateSummary(data.title, data.description);
            setAiSummary(summary);

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [url]);
    
    const handleDownload = (option: DownloadOption) => {
        if (!mediaInfo) return;
        
        // Add item to history
        const newHistoryItem: HistoryItem = {
            id: Date.now().toString(),
            title: mediaInfo.title,
            thumbnail: mediaInfo.thumbnail,
            platform: mediaInfo.platform,
            url: mediaInfo.url,
            downloadedAt: new Date().toISOString(),
        };
        setHistory([newHistoryItem, ...history.slice(0, 4)]);
        
        // Use the direct download URL from the backend
        console.log(`Downloading "${mediaInfo.title}" with quality ${option.quality} from ${option.url}`);
        
        const link = document.createElement('a');
        link.href = option.url;
        
        // Create a filename for the download
        const safeTitle = mediaInfo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${safeTitle}_${option.quality}.${option.format}`;
        link.setAttribute('download', filename);
        
        // Since the download URL from the backend might not have the correct headers to force a download,
        // we can fetch it as a blob and create a local URL. This is more robust.
        // For simplicity here, we'll directly link, which works for most direct video URLs.
        
        // Append to page, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // A browser alert is intrusive, let's just log it or provide a more subtle notification in a real app
        console.log(`Your download for "${mediaInfo.title}" (${option.quality}) has started!`);
        
        // Reset UI
        setMediaInfo(null);
        setAiSummary(null);
        setUrl('');
    };

    const handleClearHistory = () => {
        setHistory([]);
    };
    
    return (
        <div className={`min-h-screen font-sans text-gray-900 transition-colors duration-300 dark:text-gray-100 dark:bg-gray-900`}>
            <div className="absolute top-4 right-4 z-10">
                <ThemeToggle theme={theme} toggleTheme={setTheme} />
            </div>
            <main className="container mx-auto px-4 py-8 md:py-16">
                <header className="text-center mb-10">
                    <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
                        AllDownloader
                    </h1>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                        Paste any link. Download any video. Simple as that.
                    </p>
                </header>

                <div className="max-w-2xl mx-auto">
                    <UrlInputForm
                        url={url}
                        setUrl={setUrl}
                        onFetch={handleFetch}
                        isLoading={isLoading}
                        error={error}
                    />

                    {mediaInfo && (
                        <MediaPreview 
                            mediaInfo={mediaInfo} 
                            onDownload={handleDownload}
                            aiSummary={aiSummary}
                        />
                    )}

                    <HistoryList 
                        history={history} 
                        onClear={handleClearHistory}
                    />
                </div>
                 <footer className="text-center mt-12 text-sm text-gray-500 dark:text-gray-400">
                    <p>Supported Platforms:</p>
                    <div className="flex justify-center items-center gap-4 mt-2">
                        {Object.values(PLATFORMS).map(p => (
                            <div key={p.name} title={p.name} className="w-6 h-6 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all">
                                {p.icon}
                            </div>
                        ))}
                    </div>
                    <p className="mt-4">
                        By using AllDownloader, you agree to our Terms of Service. 
                        You must have the rights to download any content.
                    </p>
                </footer>
            </main>
        </div>
    );
};

export default App;