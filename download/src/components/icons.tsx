import type { SVGProps } from "react";

export function WatchtowerLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 4.5L8 2v10.5L12 15l4-2.5V2l-4 2.5z" />
      <path d="M12 15v5.5" />
      <path d="M8.5 12.5L5 14" />
      <path d="M15.5 12.5L19 14" />
      <path d="M4 20h16" />
    </svg>
  );
}
