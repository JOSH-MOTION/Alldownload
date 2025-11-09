
// FIX: Import `Dispatch` and `SetStateAction` to use them as types without needing the `React` namespace.
import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';

// FIX: Update the return type to use the imported `Dispatch` and `SetStateAction` types, resolving the "Cannot find namespace 'React'" error.
export const useLocalStorage = <T,>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] => {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            const valueToStore = typeof storedValue === 'function' 
                ? storedValue(storedValue) 
                : storedValue;
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    }, [key, storedValue]);

    return [storedValue, setStoredValue];
};
