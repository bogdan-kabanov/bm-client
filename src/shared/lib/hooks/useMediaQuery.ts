import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const media = window.matchMedia(query);
        
        const updateMatches = () => {
            setMatches(media.matches);
        };
        
        updateMatches();
        
        media.addEventListener('change', updateMatches);
        
        return () => media.removeEventListener('change', updateMatches);
    }, [query]);

    return matches;
}