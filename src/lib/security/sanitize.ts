import sanitizeHtml from "sanitize-html";

const cleanOptions: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: "discard",
};

export function sanitizeText(value: string) {
  return sanitizeHtml(value, cleanOptions).trim();
}
