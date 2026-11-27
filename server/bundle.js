// Packs the app (app/index.html with its stylesheet and scripts) into one HTML page, and gives it a version stamp (rev).
// The desktop serves this page to phones as an update; mobile/build-www.js uses the same function for the app built into
// the phone, so a phone only offers an update when the PC runs different code.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");

function bundle(appDir){
  let html = fs.readFileSync(path.join(appDir, "index.html"), "utf8");
  const read = rel => fs.readFileSync(path.join(appDir, rel.replace(/^\.?\//, "")), "utf8");
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => "<style>\n" + read(href) + "\n</style>");
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => "<script>\n" + read(src).replace(/<\/script/gi, "<\\/script") + "\n</script>");
  const rev = crypto.createHash("sha256").update(html).digest("hex").slice(0, 12);
  html = html.replace("<head>", () => `<head>\n<script>window.GF_REV="${rev}";</script>`);
  return { rev, html };
}
module.exports = { bundle };
