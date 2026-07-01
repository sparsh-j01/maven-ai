// The PDF magic-byte guard, shared by the parse route and its self-check so the
// check breaks if the route's real header logic breaks. The %PDF- signature must
// appear in the first 1KB (per the PDF spec); the client-supplied MIME type is
// untrusted.
export function isPdfHeader(bytes) {
  return new TextDecoder("latin1").decode(bytes.subarray(0, 1024)).includes("%PDF-");
}
