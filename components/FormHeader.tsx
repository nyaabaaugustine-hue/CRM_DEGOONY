"use client";

interface FormHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
}

export default function FormHeader({ icon, title, subtitle }: FormHeaderProps) {
  return (
    <div className="form-head">
      <span className="form-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="form-head-text">
        <h2>{title}</h2>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  );
}