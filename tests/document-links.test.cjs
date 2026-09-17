/* global __dirname */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}
const helpers = {};
vm.runInNewContext(compile("components/utils/documentLinks.ts"), { exports: helpers, URL });
const raw = "https://example.test/files/bai%20tap.docx?token=a%2Bb%26c&download=1";
const wrapped = helpers.getOfficeViewerUrl(raw);

test("raw, legacy encoded route and wrapped Office links retain signed query bytes", () => {
  for (const link of [raw, encodeURIComponent(raw), wrapped, encodeURIComponent(wrapped)]) {
    assert.equal(helpers.getRawDocumentUrl(link), raw);
  }
  const double = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(wrapped)}`;
  assert.equal(helpers.getRawDocumentUrl(double), raw);
  assert.equal(helpers.getOfficeViewerUrl(wrapped), wrapped);
});

test("invalid links fail and only exact Office host is unwrapped", () => {
  for (const link of ["", "javascript:alert(1)", "file:///tmp/a.docx",
    "https://view.officeapps.live.com/op/view.aspx"]) {
    assert.throws(() => helpers.getRawDocumentUrl(link));
  }
  const other = "https://example.test/view.officeapps.live.com?src=abc";
  assert.equal(helpers.getRawDocumentUrl(other), other);
});

test("type and filename support uppercase, MIME, missing extension and Office formats", () => {
  assert.equal(helpers.getDocumentType(" .DOCX ", "", ""), "docx");
  assert.equal(helpers.getDocumentType(helpers.OFFICE_MIME.xlsx, "", ""), "xlsx");
  assert.equal(helpers.getDocumentType("", "Bài tập.DOCX", ""), "docx");
  assert.equal(helpers.getDocumentType("", "", raw), "docx");
  assert.equal(helpers.getDocumentFileName("Bài tập", "docx"), "Bài tập.docx");
  assert.equal(helpers.getDocumentFileName("BAI.DOCX", "docx"), "BAI.DOCX");
  assert.equal(helpers.getDocumentFileName("../a/b", "xlsx").includes("/"), false);
});

function viewer(os = "ios", type = "docx") {
  const calls = { opened: [], downloads: [], shares: [] };
  const exports = {};
  const jsx = (component, props) => ({ component, props: props || {} });
  class File {
    constructor(...parts) { this.uri = parts.join("/"); }
    static async downloadFileAsync(url, target) {
      calls.downloads.push(url);
      return { uri: target.uri, size: 100 };
    }
  }
  vm.runInNewContext(compile("app/documents/viewer.tsx"), {
    exports, URL,
    window: { open: (url) => calls.opened.push(url) },
    require: (name) => {
      if (name === "react") return {
        useState: (value) => [value, () => {}],
        useRef: (value) => ({ current: value }),
        useEffect: (fn) => fn(),
      };
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react-native") return {
        View: "View", Text: "Text", TouchableOpacity: "Button",
        ActivityIndicator: "Spinner", Platform: { OS: os },
        Alert: { alert: () => {} }, StyleSheet: { create: (s) => s },
        Linking: { openURL: async (url) => calls.opened.push(url) },
      };
      if (name === "expo-router") return {
        Stack: { Screen: "Screen" },
        useLocalSearchParams: () => ({ link: wrapped, type, name: "Bài tập" }),
      };
      if (name === "react-native-webview") return { WebView: "WebView" };
      if (name === "expo-file-system") return { File, Paths: { cache: "cache" } };
      if (name === "expo-sharing") return {
        isAvailableAsync: async () => true,
        shareAsync: async (uri, options) => calls.shares.push({ uri, options }),
      };
      if (name === "@/components/utils/documentLinks") return helpers;
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  const buttons = [];
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.component === "Button") buttons.push(node.props);
    walk(node.props?.children);
  }
  walk(exports.default());
  return { calls, buttons };
}

test("Office viewer does not auto-launch; browser and download both use original bytes URL", async () => {
  const { calls, buttons } = viewer();
  assert.equal(calls.opened.length, 0);
  assert.equal(buttons.length, 3);
  await buttons[0].onPress();
  assert.equal(calls.opened[0], raw);
  await buttons[1].onPress();
  assert.equal(calls.downloads[0], raw);
  assert.equal(calls.shares[0].options.mimeType, helpers.OFFICE_MIME.docx);
  assert.ok(calls.shares[0].uri.endsWith(".docx"));
  buttons[2].onPress();
  assert.equal(calls.opened[1], wrapped);
});

test("Excel shares with Excel MIME/UTI; web download avoids native file APIs", async () => {
  const excel = viewer("ios", "xlsx");
  await excel.buttons[1].onPress();
  assert.equal(excel.calls.shares[0].options.UTI, helpers.OFFICE_UTI.xlsx);
  assert.equal(excel.calls.shares[0].options.mimeType, helpers.OFFICE_MIME.xlsx);
  const web = viewer("web");
  assert.equal(web.calls.opened.length, 0);
  await web.buttons[1].onPress();
  assert.equal(web.calls.opened[0], raw);
  assert.equal(web.calls.downloads.length, 0);
});