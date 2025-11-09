
import React from 'react';

interface UrlInputFormProps {
    url: string;
    setUrl: (url: string) => void;
    onFetch: () => void;
    isLoading: boolean;
    error: string | null;
}

const PasteIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
    </svg>
);

const LoadingSpinner: React.FC = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

export const UrlInputForm: React.FC<UrlInputFormProps> = ({ url, setUrl, onFetch, isLoading, error }) => {
    
    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setUrl(text);
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onFetch();
    };
    
    return (
        <div className="mb-8">
            <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row items-center gap-2 shadow-lg rounded-xl p-2 bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 focus-within:ring-2 focus-within:ring-primary-500 transition-shadow">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste your video or image link here..."
                    className="w-full p-3 text-lg bg-transparent focus:outline-none"
                    disabled={isLoading}
                />
                <div className="flex w-full sm:w-auto items-center gap-2">
                    <button
                        type="button"
                        onClick={handlePaste}
                        className="p-3 text-gray-500 hover:text-primary-500 transition-colors"
                        title="Paste from clipboard"
                        disabled={isLoading}
                    >
                        <PasteIcon className="w-6 h-6" />
                    </button>
                    <button
                        type="submit"
                        className="w-full sm:w-auto flex justify-center items-center gap-2 bg-primary-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900 transition-all duration-300 disabled:bg-primary-400 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {isLoading ? <LoadingSpinner /> : 'Fetch'}
                    </button>
                </div>
            </form>
            {error && <p className="mt-3 text-center text-red-500">{error}</p>}
        </div>
    );
};
