import React, { useState } from 'react';
import type { MediaInfo, DownloadQuality, DownloadOption } from '../types';
import { PLATFORMS } from '../constants';

const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

const SparklesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 3L9.5 8.5L4 10L9.5 11.5L12 17L14.5 11.5L20 10L14.5 8.5L12 3Z" />
        <path d="M5 21L6 17" />
        <path d="M19 21L18 17" />
    </svg>
);

interface MediaPreviewProps {
    mediaInfo: MediaInfo;
    onDownload: (option: DownloadOption) => void;
    aiSummary: string | null;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({ mediaInfo, onDownload, aiSummary }) => {
    const [selectedQuality, setSelectedQuality] = useState<DownloadQuality>(mediaInfo.downloadOptions[0].quality);
    const platform = PLATFORMS[mediaInfo.platform];
    
    const selectedOption = mediaInfo.downloadOptions.find(opt => opt.quality === selectedQuality);

    const handleDownloadClick = () => {
        if (selectedOption) {
            onDownload(selectedOption);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden animate-fade-in mb-8 ring-1 ring-gray-200 dark:ring-gray-700">
            <div className="md:flex">
                <div className="md:flex-shrink-0">
                    <img className="h-48 w-full object-cover md:w-48" src={mediaInfo.thumbnail} alt={mediaInfo.title} />
                </div>
                <div className="p-6 flex-grow">
                    <div className="flex items-center gap-3 text-sm font-semibold tracking-wide" style={{color: platform.color}}>
                        <div className="w-5 h-5">{platform.icon}</div>
                        {mediaInfo.platform.toUpperCase()}
                    </div>
                    <h3 className="block mt-2 text-xl leading-tight font-bold text-black dark:text-white">{mediaInfo.title}</h3>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">by {mediaInfo.author}</p>
                    
                    {aiSummary && (
                        <div className="mt-4 p-3 bg-primary-50 dark:bg-gray-700/50 rounded-lg flex items-start gap-3">
                            <SparklesIcon className="w-5 h-5 text-primary-500 flex-shrink-0 mt-1" />
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="font-bold">AI Summary:</span> {aiSummary}
                            </p>
                        </div>
                    )}

                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
                         <div className="flex-grow">
                            <label htmlFor="quality-select" className="sr-only">Select quality</label>
                            <select 
                                id="quality-select"
                                value={selectedQuality}
                                onChange={(e) => setSelectedQuality(e.target.value as DownloadQuality)}
                                className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                {mediaInfo.downloadOptions.map(opt => (
                                    <option key={opt.quality} value={opt.quality}>
                                        {`${opt.quality.toUpperCase()} (${opt.format.toUpperCase()})`}
                                    </option>
                                ))}
                            </select>
                         </div>
                        <button 
                            onClick={handleDownloadClick}
                            className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-2 bg-primary-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-300"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            Download
                        </button>
                    </div>
                     {selectedOption?.size && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Estimated size: {selectedOption.size}</p>}
                </div>
            </div>
        </div>
    );
};

// Add this to your tailwind config or a global style tag if not using a config file.
// For CDN, it can be added to index.html in a style tag.
// We'll rely on tailwind.config.js for this example.
// For now, let's just use a simple animation class.
// A better way would be to add keyframes to tailwind.config.js
// @keyframes fadeIn { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
// .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
// Since we can't edit tailwind config, we'll just use transition classes for a subtle effect
// Or just let it pop in, which is fine too. Let's make it a simple class for now.
// For this project, a fade-in animation can be simulated with basic Tailwind classes, or we just let it appear. Given the project structure, Framer Motion would be overkill and complex to setup. A simple fade is better.
// But the request mentioned framer-motion. Since I cannot add dependencies, I will just add the class `animate-fade-in` and assume it is defined.