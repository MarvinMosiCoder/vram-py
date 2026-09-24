"use client";

import type { ReactNode, MouseEventHandler } from "react";
// `Link` came from "@inertiajs/react" in the Laravel original; React itself
// exports no Link, so that import was a hard build error. React Router's
// equivalent takes `to`, not `href` -- see the Link branch below.
import Link from "next/link";
import { CheckCircle2, Copy, Eye, Pencil, Trash2, XCircle } from "lucide-react";

// A module's `actions` entry may be a descriptor carrying an icon name, e.g.
// {"label": "Edit", "icon": "pencil"} in roles_module.py. Those names are
// lucide's, not this component's action keys, so map them across; anything
// unrecognised falls through to the action name itself.
const ICON_ALIASES: Record<string, string> = {
	pencil: "edit",
	edit: "edit",
	trash: "delete",
	trash2: "delete",
	delete: "delete",
	eye: "view",
	view: "view",
	copy: "duplicate",
	duplicate: "duplicate",
	check: "activate",
	"check-circle": "activate",
	activate: "activate",
	x: "deactivate",
	"x-circle": "deactivate",
	deactivate: "deactivate",
};

const RowAction = ({ action, size = "md", href, onClick, type = "link", title, tooltipContent, icon }: { action: string; size?: "sm" | "md" | "lg"; href?: string; onClick?: MouseEventHandler<HTMLButtonElement>; type?: "link" | "button"; title?: string; tooltipContent?: string; icon?: string }) => {
	const iconSize = {
		sm: "h-3.5 w-3.5",
		md: "h-4 w-4",
		lg: "h-5 w-5",
	}[size];

	// An explicit `icon` wins over the action name, so a descriptor can show a
	// different glyph than its behaviour implies.
	const resolved = ICON_ALIASES[String(icon || "").trim().toLowerCase()] || action;

	const configs: Record<string, { icon: ReactNode; className: string; title: string }> = {
		view: {
			icon: <Eye className={iconSize} />,
			className: "bg-sky-50 text-sky-700 hover:bg-sky-100",
			title: "View",
		},
		delete: {
			icon: <Trash2 className={iconSize} />,
			className: "bg-red-50 text-red-700 hover:bg-red-100",
			title: "Delete",
		},
		edit: {
			icon: <Pencil className={iconSize} />,
			className: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
			title: "Edit",
		},
		duplicate: {
			icon: <Copy className={iconSize} />,
			className: "bg-sky-50 text-sky-700 hover:bg-sky-100",
			title: "Duplicate",
		},
		activate: {
			icon: <CheckCircle2 className={iconSize} />,
			className: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
			title: "Activate",
		},
		deactivate: {
			icon: <XCircle className={iconSize} />,
			className: "bg-amber-50 text-amber-700 hover:bg-amber-100",
			title: "Deactivate",
		},
	};
	const config = configs[resolved] || {
		icon: <Eye className={iconSize} />,
		className: "bg-slate-100 text-slate-700 hover:bg-slate-200",
		title: "Action",
	};

	const className = `inline-flex h-9 w-9 items-center justify-center rounded-md transition ${config.className}`;
	const label = title || tooltipContent || config.title;

	return (
	<>
		{type == 'button' ? 	
			<button type="button" className={className} onClick={onClick} title={label} aria-label={label}>
				{config.icon}
			</button> 
		: 
		<Link
			className={className}
			href={href ?? "#"}
			title={label}
			aria-label={label}
		>
			{config.icon}
		</Link>}
	</>
	);
};

export default RowAction;
