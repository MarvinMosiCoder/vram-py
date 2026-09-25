"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import Button from "@/components/button/PrimaryButton";
import SecondaryButton from "@/components/button/SecondaryButton";
import useThemeStyles from "@/hooks/useThemeStyles";
import { useTheme } from "@/context/ThemeContext";

type CardProps = {
    children: ReactNode;
    headerName: string;
    iconClass?: string;
    themeHead?: string;
    marginBottom?: number;
    loading?: boolean;
    withButton?: boolean;
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
    href?: string;
};

const Card = ({ themeHead = "", children, headerName, iconClass, marginBottom, loading, withButton, onClick, href = "/" }: CardProps) => {
    const { theme } = useTheme();
    const { sideBarTextColor, bgColor } = useThemeStyles(theme);
    return (
        <div className={`shadow-sm rounded-md ${bgColor} w-full justify-start flex flex-col`} style={{ marginBottom: `${Number(marginBottom || 0) * 0.25}rem` }}>
            <div className={`${themeHead} p-3 rounded-tl-md rounded-tr-md border-b border-skin-border`}>
                <p className={`${sideBarTextColor} font-extrabold`}>
                    <i className={iconClass}></i> {headerName}
                </p>
            </div>
            <div className="p-5">
                {children}
            </div>
            {withButton && (
                <div className="p-2 border-t-2 border-skin-border mt-3">
                    <Link href={href}>
                        <SecondaryButton
                            type="button"
                        >
                          <i className="fa fa-times-circle text-skin-dim"></i>  Cancel
                        </SecondaryButton>
                    </Link>
                    <Button
                        type="button"
                        className="float-right"
                        disabled={loading}
                        onClick={onClick}
                    >
                     <i className="fa fa-save"></i>   {loading ? "Saving..." : "Save"}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default Card;
