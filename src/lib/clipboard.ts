export async function copyText(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Secure-context clipboard can be denied; fall through to execCommand.
  }

  try {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "0";
    field.style.left = "0";
    field.style.width = "1px";
    field.style.height = "1px";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.focus();
    field.select();
    field.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  } catch {
    return false;
  }
}
