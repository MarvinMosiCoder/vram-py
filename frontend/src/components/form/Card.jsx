import { Link } from "react-router-dom";
import Button from "../button/PrimaryButton";
import SecondaryButton from "../button/SecondaryButton";
import useThemeStyles from "../../hooks/useThemeStyles";
import { useTheme } from "../../context/ThemeContext";

const Card = ({ themeHead = "", children, headerName, iconClass, marginBottom, loading, withButton, onClick, href, setTextColor }) => {
    const {theme} = useTheme();
    const { sideBarTextColor, bgColor} = useThemeStyles(theme);
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
                    <Link to={href}>
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
