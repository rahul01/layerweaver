export function scadEscape(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Shared "text outline" technique used by every product built on this
// customizer: the base plate isn't a fixed rectangle/circle - it's the union
// of the text glyphs themselves, offset outward by `extension` mm. Products
// differ only in what attachment feature (keyring hole, pencil socket, ...)
// they add on top of this shared base_outline()/engraving() pair.
export function textOutlineHeader({ lines, font, textSize, extension }) {
  const linesArr = '[' + lines.map(l => `"${scadEscape(l)}"`).join(', ') + ']';
  return `
$fn = 48;
lines = ${linesArr};
font = "${font}";
text_size = ${textSize};
extension = ${extension};

line_h = text_size * 1.3;
max_len = max([for (l = lines) len(l) == 0 ? 1 : len(l)]);
content_w = max(26, max_len * text_size * 0.62);
content_h = max(text_size * 1.15, len(lines) * line_h);

module engraving() {
  n = len(lines);
  for (i = [0 : n - 1]) {
    y_off = (n - 1) / 2 * line_h - i * line_h;
    translate([content_w/2, content_h/2 + y_off])
      text(lines[i], size = text_size, font = font, halign = "center", valign = "center");
  }
}

// A cursive/connected font (e.g. Pacifico) keeps this as one contiguous
// shape; a font with disconnected letters can leave gaps unless extension
// is large enough to bridge them - that's inherent to this style.
module base_outline() {
  offset(delta = extension) engraving();
}

// Rounds concave (inward-facing) corners without changing overall size - a
// "closing" morphological operation: grow by r, then shrink back by r.
module fillet_concave(r) {
  offset(r = -r) offset(r = r) children();
}
`;
}
