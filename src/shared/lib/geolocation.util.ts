export interface GeolocationData {
    countryCode: string;
    countryName: string;
    ip?: string;
}

export async function detectUserCountry(): Promise<GeolocationData | null> {
    try {
        // В режиме разработки пропускаем внешний API из-за CORS проблем
        // Пытаемся определить страну по IP через бесплатный API (только в production)
        if (import.meta.env.PROD) {
            try {
                const response = await fetch('https://ipapi.co/json/', {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.country_code && data.country_name) {
                        return {
                            countryCode: data.country_code.toUpperCase(),
                            countryName: data.country_name,
                            ip: data.ip,
                        };
                    }
                }
            } catch (ipError) {
                // Если API не доступен, продолжаем с fallback методами
                console.log('IP geolocation API недоступен, используем fallback методы');
            }
        } else {
            // В dev режиме сразу используем fallback методы
            console.log('Dev режим: используем fallback методы для определения страны');
        }

        // Fallback 1: Пытаемся по локализации браузера
        const locale = navigator.language || (navigator as any).userLanguage;
        const countryCode = locale.split('-')[1]?.toUpperCase();

        if (countryCode) {
            return {
                countryCode,
                countryName: countryCode,
            };
        }

        // Fallback 2: Пытаемся по часовому поясу
        try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const timezoneMap: { [key: string]: string } = {
                'Europe/Kiev': 'UA',
                'Europe/Moscow': 'RU',
                'Europe/Minsk': 'BY',
                'Europe/Berlin': 'DE',
                'Europe/Paris': 'FR',
                'Europe/London': 'GB',
                'Europe/Rome': 'IT',
                'Europe/Madrid': 'ES',
                'America/New_York': 'US',
                'America/Los_Angeles': 'US',
                'America/Toronto': 'CA',
                'Asia/Shanghai': 'CN',
                'Asia/Tokyo': 'JP',
            };
            
            const detectedCountryCode = timezoneMap[timezone];
            if (detectedCountryCode) {
                return {
                    countryCode: detectedCountryCode,
                    countryName: detectedCountryCode,
                };
            }
        } catch (timezoneError) {
            // Продолжаем
        }

        // Fallback 3: Пытаемся по resolved locale
        const resolvedLocale = Intl.DateTimeFormat().resolvedOptions().locale;
        const resolvedCountry = resolvedLocale.split('-')[1]?.toUpperCase();

        if (resolvedCountry) {
            return {
                countryCode: resolvedCountry,
                countryName: resolvedCountry,
            };
        }

        return null;
    } catch (error) {
        console.error('Ошибка при определении страны:', error);
        return null;
    }
}

export function getCountryCodeFromLocale(): string | null {
    try {
        const locale = navigator.language || (navigator as any).userLanguage;
        const countryCode = locale.split('-')[1]?.toUpperCase();
        return countryCode || null;
    } catch (error) {

        return null;
    }
}

