import type { ImgHTMLAttributes } from "react";

export function WatchtowerLogo(props: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img src="./icon.png" alt="Arkalogi" width="24" height="24" {...props} />
  );
}