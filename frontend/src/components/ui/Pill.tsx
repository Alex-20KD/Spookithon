import React from "react";
type Color = "green" | "red" | "orange" | "blue" | "default";
export default function Pill({ children, color = "default" }: { children: React.ReactNode; color?: Color }) {
  return <span className={`pill ${color}`}>{children}</span>;
}