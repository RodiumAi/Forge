import { describe, expect, it, vi } from "vitest";

import { fireEvent, renderWithProviders, screen } from "@/test/render";

import { BrandIntakeDialog } from "./BrandIntakeDialog";

describe("BrandIntakeDialog", () => {
  it("asks for the name before submitting", async () => {
    const onSubmit = vi.fn();
    const { user } = renderWithProviders(<BrandIntakeDialog open onClose={() => {}} onSubmit={onSubmit} />);
    expect(await screen.findByRole("dialog", { name: "Créer une charte graphique" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Créer la charte/ }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Indiquez le nom de la marque.")).toBeTruthy();

    await user.type(screen.getByLabelText(/Nom de la marque/), "Nova");
    await user.type(screen.getByLabelText("Site web"), "http://nova.fr");
    await user.click(screen.getByRole("button", { name: /Créer la charte/ }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("L'adresse doit commencer par https://")).toBeTruthy();

    await user.clear(screen.getByLabelText("Site web"));
    await user.type(screen.getByLabelText("Site web"), "https://nova.fr");
    await user.click(screen.getByRole("button", { name: "Expert" }));
    await user.click(screen.getByRole("button", { name: /Créer la charte/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const fields = onSubmit.mock.calls[0][0];
    expect(fields.name).toBe("Nova");
    expect(fields.website).toBe("https://nova.fr");
    expect(fields.tones).toEqual(["expert"]);
    expect(fields.language).toBe("fr");
  });

  it("prefills the name from a short composer text", async () => {
    renderWithProviders(<BrandIntakeDialog open initialText="Nova Pay" onClose={() => {}} onSubmit={() => {}} />);
    expect(((await screen.findByLabelText(/Nom de la marque/)) as HTMLInputElement).value).toBe("Nova Pay");
  });

  it("refuses a logo of the wrong type", async () => {
    renderWithProviders(<BrandIntakeDialog open onClose={() => {}} onSubmit={() => {}} />, { locale: "en" });
    const input = (await screen.findByLabelText("Main logo")) as HTMLInputElement;
    // The picker's accept filter is bypassed on purpose: a drop or "All files" can still hand any file over.
    fireEvent.change(input, { target: { files: [new File(["x"], "logo.gif", { type: "image/gif" })] } });
    expect(screen.getByText("Use a PNG, SVG, JPG or WebP image.")).toBeTruthy();
    // The dark version stays off without a main logo.
    expect((screen.getByLabelText(/Dark background version/) as HTMLInputElement).disabled).toBe(true);
  });
});
