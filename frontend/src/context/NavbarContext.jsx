import React, { createContext, useState, useEffect, useContext } from "react";

export const NavbarContext = createContext();

export const NavbarProvider = ({ children }) => {
    const [title, setTitle] = useState();

    // useEffect(() => {
    //     setTitle(formatPathname(window.location.pathname));
    // }, [window.location.pathname]);

    return (
        <NavbarContext.Provider value={{ title, setTitle }}>
            {children}
        </NavbarContext.Provider>
    );
};

export const useNavbarContext = () => {
    return useContext(NavbarContext);
};
