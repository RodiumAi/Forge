import type { ReactNode } from "react";
import { fb, photo } from "../data";

type Props = {
  ava: string;
  index: number;
  w: number;
  size?: "sm" | "lg";
  me?: boolean;
  children?: ReactNode;
};

/* Gradient story ring around an avatar (stories, post header, profile). */
export default function Ring({ ava, index, w, size, me, children }: Props) {
  const cls = ["ring", size, me ? "me" : ""].filter(Boolean).join(" ");
  return (
    <span className={cls}>
      <span className="ring-in" style={{ backgroundImage: fb(index) }}>
        <img src={photo(ava, w)} alt="" />
      </span>
      {children}
    </span>
  );
}
