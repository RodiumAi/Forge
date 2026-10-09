import { fb, photo } from "../data";

type Props = { id: string; index: number; w: number; tall?: boolean };

/* One square (or tall) tile of the explore and profile grids. */
export default function PhotoCell({ id, index, w, tall }: Props) {
  return (
    <span className={tall ? "cell tall" : "cell"} style={{ backgroundImage: fb(index) }}>
      <img src={photo(id, w)} alt="" />
    </span>
  );
}
