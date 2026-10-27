import type { Device } from "../data";
import { useHome } from "./HomeState";

/** Glass tile for one device: tap to switch it, it glows amber while on. */
export default function DeviceTile({ device, roomName }: { device: Device; roomName?: string }) {
  const { toggle } = useHome();
  const Icon = device.icon;
  const state = device.on ? (device.level !== undefined ? `On, ${device.level}%` : device.detail ?? "On") : "Off";

  return (
    <button
      className={device.on ? "device on" : "device"}
      onClick={() => toggle(device.id)}
      aria-pressed={device.on}
      aria-label={`${device.name}, ${state}`}
    >
      <span className="device-top">
        <span className="device-icon"><Icon size={20} strokeWidth={1.9} aria-hidden /></span>
        <span className="switch" aria-hidden><i /></span>
      </span>
      <strong>{device.name}</strong>
      <span className="device-state">{roomName ? `${roomName}, ` : ""}{state}</span>
    </button>
  );
}
