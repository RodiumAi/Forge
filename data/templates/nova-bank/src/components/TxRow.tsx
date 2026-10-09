import type { Tx } from "../data";
import ListRow from "./ListRow";

export default function TxRow({ tx }: { tx: Tx }) {
  return (
    <ListRow icon={tx.icon} title={tx.name} sub={tx.cat}>
      <span className={tx.in ? "amount in" : "amount"}>{tx.amt}</span>
    </ListRow>
  );
}
