// Builds www/ for the phone app: the whole app packed into one page (server/bundle.js, the same packing the PC uses for
// updates, so the version stamps match), with the phone loader first in <head>.
const fs = require("fs"), path = require("path");
const { bundle } = require("../server/bundle");
const dst = path.join(__dirname, "www");
fs.rmSync(dst, { recursive: true, force: true }); fs.mkdirSync(dst, { recursive: true });
const { rev, html } = bundle(path.join(__dirname, "..", "app"));
const loader = fs.readFileSync(path.join(__dirname, "phone-loader.html"), "utf8").replace("__REV__", rev);
fs.writeFileSync(path.join(dst, "index.html"), html.replace("<head>", () => "<head>\n" + loader));
console.log("phone app rev", rev);
