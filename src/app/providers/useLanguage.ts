import { useContext } from 'react';
import {LanguageContext, LanguageContextType} from "@src/app/providers/LanguageProvider.tsx";

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};