import { describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "@/test/render";
import { ClarifyCard, type ClarifyQuestion } from "./ClarifyCard";

function q(id: string, prompt: string): ClarifyQuestion {
  return {
    id,
    prompt,
    options: [
      { id: "a", label: `${id} option A` },
      { id: "b", label: `${id} option B` },
    ],
  };
}

function mount(questions: ClarifyQuestion[], onSubmit = vi.fn()) {
  renderWithProviders(<ClarifyCard questions={questions} onSubmit={onSubmit} />);
  return onSubmit;
}

describe("flat mode (3 questions or fewer)", () => {
  it("shows every question at once and submits option ids", () => {
    const onSubmit = mount([q("one", "First?"), q("two", "Second?")]);
    fireEvent.click(screen.getByText("one option A"));
    fireEvent.click(screen.getByText("two option B"));
    fireEvent.click(screen.getByText("Continuer"));
    expect(onSubmit).toHaveBeenCalledWith({ one: "a", two: "b" });
  });

  it("free text overrides the picked option and is sent verbatim", () => {
    const onSubmit = mount([q("name", "Developer name?")]);
    fireEvent.click(screen.getByText("name option A"));
    const input = screen.getByPlaceholderText(/saisissez votre propre/i);
    fireEvent.change(input, { target: { value: "Alexandre Mercier" } });
    fireEvent.click(screen.getByText("Continuer"));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Alexandre Mercier" });
  });
});

describe("wizard mode (more than 3 questions)", () => {
  const FOUR = [q("q1", "One?"), q("q2", "Two?"), q("q3", "Three?"), q("q4", "Four?")];

  it("shows one question at a time with progress", () => {
    mount(FOUR);
    expect(screen.getByText("One?")).toBeTruthy();
    expect(screen.queryByText("Two?")).toBeNull();
    expect(screen.getByText("1/4")).toBeTruthy();
  });

  it("next is locked until the current question is answered", () => {
    mount(FOUR);
    const next = screen.getByText("Suivant") as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(screen.getByText("q1 option A"));
    expect(next.disabled).toBe(false);
  });

  it("walks through all steps and submits the full answer set", () => {
    const onSubmit = mount(FOUR);
    for (const id of ["q1", "q2", "q3"]) {
      fireEvent.click(screen.getByText(`${id} option A`));
      fireEvent.click(screen.getByText("Suivant"));
    }
    expect(screen.getByText("4/4")).toBeTruthy();
    fireEvent.click(screen.getByText("q4 option B"));
    fireEvent.click(screen.getByText("Continuer"));
    expect(onSubmit).toHaveBeenCalledWith({ q1: "a", q2: "a", q3: "a", q4: "b" });
  });

  it("back returns to the previous question with the answer kept", () => {
    mount(FOUR);
    fireEvent.click(screen.getByText("q1 option A"));
    fireEvent.click(screen.getByText("Suivant"));
    fireEvent.click(screen.getByText("Retour"));
    expect(screen.getByText("One?")).toBeTruthy();
    expect(screen.getByText("q1 option A").className).toContain("selected");
  });
});
