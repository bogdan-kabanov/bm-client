export const isFormError = (error: string | null): boolean => {
    if (!error) return false;
    
    return error.includes('Invalid password') || 
           error.includes('Invalid email or password') || 
           error.includes('Invalid credentials') ||
           error.includes('User not found');
};

export const shouldRedirectToHome = (error: string | null): boolean => {
    if (!error) return false;
    return window.location.pathname !== '/' && !isFormError(error);
};

