export function esc(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char));
}

export function paragraphs(text: string): string {
  return text.split('\n\n').map((part) => `<p>${esc(part)}</p>`).join('');
}
