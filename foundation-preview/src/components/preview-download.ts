export function downloadText(filename: string, content: string, type: string): string | null {
  try {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'The browser could not start the download.';
  }
}
