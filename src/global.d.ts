declare global {
    interface TelegramWebApp {
        initData: string;
        ready: () => void;
        initDataUnsafe?: {
            user?: {
                id: number;
                first_name?: string;
                last_name?: string;
                username?: string;
                language_code?: string;
                is_premium?: boolean;
                allows_write_to_pm?: boolean;
            };
            chat_type?: string;
            chat_instance?: string;
            start_param?: string;
            auth_date?: number;
            hash?: string;
        };
        [key: string]: unknown;
    }

    interface Window {
        Telegram?: {
            WebApp?: TelegramWebApp;
        };
    }
}

export {};