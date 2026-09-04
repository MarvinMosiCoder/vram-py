// Ported from the Laravel project's Components/Notification/ColorMap.js --
// same letter -> Tailwind color mapping, so the same name gets the same
// avatar color in both projects. A few letters had no color there (the
// class was ''); filled in here so every avatar gets a readable
// background instead of falling through to transparent.
const colorMap = {
  A: "bg-amber-300",
  B: "bg-blue-300",
  C: "bg-cyan-300",
  D: "bg-rose-300",
  E: "bg-emerald-300",
  F: "bg-fuchsia-300",
  G: "bg-green-300",
  H: "bg-orange-300",
  I: "bg-indigo-300",
  J: "bg-pink-300",
  K: "bg-lime-300",
  L: "bg-lime-300",
  M: "bg-purple-300",
  N: "bg-neutral-300",
  O: "bg-orange-300",
  P: "bg-purple-300",
  Q: "bg-teal-300",
  R: "bg-red-300",
  S: "bg-sky-300",
  T: "bg-teal-300",
  U: "bg-violet-300",
  V: "bg-violet-300",
  W: "bg-slate-300",
  X: "bg-zinc-300",
  Y: "bg-yellow-300",
  Z: "bg-zinc-300",
};

export default colorMap;
