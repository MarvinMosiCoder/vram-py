import colorMap from "./colorMap";

const getInitials = (value) => {
  const parts = (value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Stands in for the Laravel project's Components/Avatar/AvatarImage.jsx.
// That version can render an uploaded profile photo; this backend has no
// avatar-upload column or file storage at all, so this is initials-only --
// the color-by-letter part of the original is what's worth keeping.
const Avatar = ({ name, size = "md" }) => {
  const initials = getInitials(name);
  const bgClass = colorMap[initials.charAt(0)] || "bg-slate-300";

  return (
    <div className={`avatar avatar-${size} ${bgClass}`}>
      <span>{initials}</span>
    </div>
  );
};

export default Avatar;
