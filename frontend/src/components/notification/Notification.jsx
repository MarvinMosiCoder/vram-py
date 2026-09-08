import React from "react";
import { Link } from "react-router-dom";
import colorMap from "./ColorMap";

const Notification = ({ id, message, type = "General", onClick, isRead, url, created }) => {
  if (!message) return null;

  const getInitials = (fullName) => {
    const names = String(fullName || "General").trim().split(" ");
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }

    const initials = names[0].charAt(0) + names[names.length - 1].charAt(0);
    return initials.toUpperCase();
  };

  const initials = getInitials(type);
  const backgroundColor = colorMap[initials.charAt(0)] || "bg-skin-blue-light";

  const timeDifference = (timestamp) => {
    if (!timestamp) return "now";

    const now = new Date();
    const date = new Date(timestamp);
    const differenceInSeconds = Math.floor((now - date) / 1000);

    if (differenceInSeconds < 60) return `${differenceInSeconds}s`;
    if (differenceInSeconds < 3600) return `${Math.floor(differenceInSeconds / 60)}m`;
    if (differenceInSeconds < 86400) return `${Math.floor(differenceInSeconds / 3600)}h`;
    return `${Math.floor(differenceInSeconds / 86400)}d`;
  };

  return (
    <Link
      to={id ? `/notifications/view-notification/${id}` : "/notifications"}
      className={`block rounded-md text-skin-text transition hover:bg-skin-border ${isRead ? "text-skin-dim" : "text-skin-text"}`}
    >
      <div
        className="flex w-83 items-center gap-2 border-b border-skin-border p-2 pl-5 hover:bg-skin-border"
        onClick={(e) => {
          if (typeof onClick === "function") onClick(e, id, url);
        }}
      >
        <div className={`${backgroundColor} mt-2 flex h-7.5 w-7.5 items-center justify-center rounded-full p-8`}>
          <p className="text-center text-[30px] text-white">{getInitials(type)}</p>
        </div>

        <div className="mt-1 flex flex-col text-left text-[14px]">
          <span>{message}</span>
          <span className="text-[14px] text-skin-dim">{timeDifference(created)}</span>
        </div>

        <span className={`pl-px text-lg ${isRead === 1 ? "text-skin-dim" : "text-green-500"}`}>
          <i className="fa fa-circle" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
};

export default Notification;
