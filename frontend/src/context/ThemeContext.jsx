import React, { createContext, useContext, useState, useEffect } from 'react';
import { applyThemeColor, getThemeClass, isCustomThemeColor, resolveThemeColor } from '../config/themeOptions';

// Create a context for the theme
const ThemeContext = createContext();
// Create a context for the profile
const ProfileContext = createContext();

// Custom hook to use the theme context
export const useTheme = () => {
    return useContext(ThemeContext);
};

// Custom hook to use the profile context
export const useProfile = () => {
    return useContext(ProfileContext);
}


// Create a provider component
export const ThemeProvider = ({ children, themeColor, profileData }) => {
    const [theme, setTheme] = useState(getThemeClass(themeColor));
    const [profile, setProfile] = useState(profileData || null);

    useEffect(() => {
        applyThemeColor(themeColor);
        setTheme(getThemeClass(themeColor));
    }, [themeColor]);

    useEffect(() => {
        const resolvedTheme = theme.replace(/^bg-/, '');
        const isDark = resolvedTheme === 'skin-black';
        document.documentElement.classList.toggle('app-theme-dark', isDark);
        document.documentElement.dataset.appTheme = isCustomThemeColor(themeColor) ? 'custom' : resolveThemeColor(resolvedTheme);

        return () => {
            document.documentElement.classList.remove('app-theme-dark');
            delete document.documentElement.dataset.appTheme;
        };
    }, [theme]);

    return (
        <ThemeContext.Provider value={{theme, setTheme}}>
           <ProfileContext.Provider value={{ profile, setProfile }}>
                {children}
            </ProfileContext.Provider>
        </ThemeContext.Provider>
    );
};