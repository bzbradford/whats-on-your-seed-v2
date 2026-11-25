// The CPN fact sheet PDF lives in public/assets/ (written by pipeline/build_fact_sheet.py).
// Pages links to it; the standalone file embeds it as a data: URL, as legacy did.

export async function factSheetUrl(): Promise<string> {
  if (import.meta.env.MODE === 'standalone') {
    const pdf = await import('../../public/assets/CPN_Seed_Treatment_Comparison.pdf?inline');
    return pdf.default;
  }
  return `${import.meta.env.BASE_URL}assets/CPN_Seed_Treatment_Comparison.pdf`;
}
