import React from "react";

export default function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`card ${className}`}>
      {title && <div className="card-title">{title}</div>}
      {children}
    </div>
  );
}