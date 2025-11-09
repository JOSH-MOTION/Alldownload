
import React from 'react';
import type { HistoryItem } from '../types';
import { PLATFORMS } from '../constants';

interface HistoryListProps {
    history: HistoryItem[];
    onClear: () => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ history, onClear }) => {
    if (history.length === 0) {
        return null;
    }

    return (
        <div className="mt-12">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Recent Downloads</h2>
                <button
                    onClick={onClear}
                    className="text-sm text-gray-500 hover:text-red-500 transition-colors"
                >
                    Clear History
                </button>
            </div>
            <ul className="space-y-3">
                {history.map(item => {
                    const platform = PLATFORMS[item.platform];
                    return (
                        <li key={item.id} className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
                            <img src={item.thumbnail} alt={item.title} className="w-16 h-10 object-cover rounded-md mr-4" />
                            <div className="flex-grow">
                                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={item.title}>{item.title}</p>
                                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 gap-2 mt-1">
                                    <div className="w-4 h-4" style={{ color: platform.color }}>
                                        {platform.icon}
                                    </div>
                                    <span>{item.platform}</span>
                                </div>
                            </div>
                            <a 
                                href={item.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="ml-4 text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200"
                            >
                                View Original
                            </a>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};
