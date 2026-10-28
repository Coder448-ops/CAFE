"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-coffee-800 px-4 py-2.5 text-sm font-semibold text-cream-50 hover:bg-coffee-900"
    >
      Chop etish
    </button>
  );
}
