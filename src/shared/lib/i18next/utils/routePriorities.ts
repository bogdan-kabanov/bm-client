export type TranslationModule = 
  | 'common' 
  | 'errors' 
  | 'messages' 
  | 'menu' 
  | 'auth' 
  | 'verifyEmail'
  | 'profile' 
  | 'bots' 
  | 'referrals' 
  | 'trading' 
  | 'withdrawal' 
  | 'deposit' 
  | 'payments' 
  | 'kyc' 
  | 'support' 
  | 'copyTrading' 
  | 'landing';

export interface RoutePriority {
  path: string;
  priority: TranslationModule[];
  secondary?: TranslationModule[];
}

const routePriorities: RoutePriority[] = [
  {
    path: '/',
    priority: ['common', 'menu', 'landing', 'auth'],
    secondary: ['errors', 'messages']
  },
  {
    path: '/trading',
    priority: ['common', 'menu', 'trading', 'errors'],
    secondary: ['messages', 'profile']
  },
  {
    path: '/profile',
    priority: ['common', 'menu', 'profile', 'errors', 'messages'],
    secondary: ['kyc', 'verifyEmail', 'auth']
  },
  {
    path: '/bots',
    priority: ['common', 'menu', 'bots', 'errors', 'messages'],
    secondary: []
  },
  {
    path: '/referrals',
    priority: ['common', 'menu', 'referrals', 'errors', 'messages'],
    secondary: ['profile']
  },
  {
    path: '/copy-trading',
    priority: ['common', 'menu', 'copyTrading', 'errors', 'messages'],
    secondary: ['profile']
  },
  {
    path: '/support',
    priority: ['common', 'menu', 'support', 'errors', 'messages'],
    secondary: ['auth']
  },
  {
    path: '/email/verify',
    priority: ['common', 'verifyEmail', 'errors', 'messages'],
    secondary: ['auth']
  }
];

export const getRoutePriorities = (pathname: string): { priority: TranslationModule[], secondary: TranslationModule[] } => {
  const exactMatch = routePriorities.find(r => r.path === pathname);
  if (exactMatch) {
    return {
      priority: exactMatch.priority,
      secondary: exactMatch.secondary || []
    };
  }

  const prefixMatch = routePriorities.find(r => pathname.startsWith(r.path));
  if (prefixMatch) {
    return {
      priority: prefixMatch.priority,
      secondary: prefixMatch.secondary || []
    };
  }

  return {
    priority: ['common', 'menu', 'errors'],
    secondary: ['messages']
  };
};

export const getAllModules = (): TranslationModule[] => {
  return [
    'common',
    'errors',
    'messages',
    'menu',
    'auth',
    'verifyEmail',
    'profile',
    'bots',
    'referrals',
    'trading',
    'withdrawal',
    'deposit',
    'payments',
    'kyc',
    'support',
    'copyTrading',
    'landing'
  ];
};

