import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, within } from "@/test/render";

import { CountryPicker } from "./CountryPicker";
import { StairsMeter } from "./Meter";
import { MenuItem, Popover } from "./Popover";
import { Switch } from "./Switch";
import { Segmented, Tabs } from "./Tabs";

const COUNTRIES = [
  { iso2: "TG", name: "Togo", currencyCode: "XOF", methodsCount: 2 },
  { iso2: "GH", name: "Ghana", currencyCode: "GHS", methodsCount: 3 },
  { iso2: "BJ", name: "Benin", currencyCode: "XOF", methodsCount: 1 },
];

function PickerHarness({ onPick }: { onPick: (iso: string) => void }) {
  const [value, setValue] = useState("TG");
  return (
    <CountryPicker
      value={value}
      countries={COUNTRIES}
      onChange={(iso) => {
        setValue(iso);
        onPick(iso);
      }}
    />
  );
}

describe("CountryPicker", () => {
  it("opens, filters by name or currency and picks with the keyboard", async () => {
    const onPick = vi.fn();
    const { user } = renderWithProviders(<PickerHarness onPick={onPick} />);
    const trigger = screen.getByRole("button", { name: /Pays et devise : Togo, XOF|Pays et devise: Togo, XOF/ });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    // Localised names (Bénin in French) and the method count from the API.
    expect(screen.getByRole("option", { name: /Bénin/ })).toHaveTextContent("1 moyen de paiement");

    await user.type(screen.getByRole("combobox"), "ghs");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{Enter}");
    expect(onPick).toHaveBeenCalledWith("GH");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: /Ghana, GHS/ })).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const { user } = renderWithProviders(<PickerHarness onPick={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /Togo/ });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });
});

describe("Popover", () => {
  it("opens a menu, moves with the arrows and closes on Escape", async () => {
    const onRename = vi.fn();
    const { user } = renderWithProviders(
      <Popover trigger={<button type="button">Actions</button>} label="Actions">
        {(close) => (
          <>
            <MenuItem onClick={close}>Ouvrir</MenuItem>
            <MenuItem
              onClick={() => {
                onRename();
                close();
              }}
            >
              Renommer
            </MenuItem>
          </>
        )}
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);
    const menu = screen.getByRole("menu");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowDown}");
    expect(within(menu).getByRole("menuitem", { name: "Renommer" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onRename).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe("Tabs and Segmented", () => {
  it("select with arrow keys", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <Tabs
        label="Vue"
        value="a"
        onChange={onChange}
        items={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
      />,
    );
    const first = screen.getByRole("tab", { name: "A" });
    expect(first).toHaveAttribute("aria-selected", "true");
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("marks the pressed segment", () => {
    renderWithProviders(
      <Segmented
        label="Langue"
        value="en"
        onChange={() => undefined}
        items={[
          { id: "fr", label: "FR" },
          { id: "en", label: "EN" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "FR" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("Switch and StairsMeter", () => {
  it("toggles", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Switch checked={false} onChange={onChange} label="Notifications" />);
    await user.click(screen.getByRole("switch", { name: "Notifications" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("lights the steps of the remaining ratio", () => {
    renderWithProviders(<StairsMeter value={0.5} label="FRODI" steps={12} />);
    const meter = screen.getByRole("meter", { name: "FRODI" });
    expect(meter).toHaveAttribute("aria-valuenow", "50");
    expect(meter.querySelectorAll("i.on")).toHaveLength(6);
  });
});
