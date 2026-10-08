// A workflow command for an error annotation. GitHub decodes %25, %0D and %0A in its message.
export function errorAnnotation(message) {
  const encoded = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  return `::error::${encoded}`;
}
