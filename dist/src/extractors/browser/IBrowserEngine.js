/**
 * IBrowserEngine — Stable interface for browser-based extractors in CIC
 *
 * Enables plug-and-play browser engines (CloakBrowser, Playwright, etc.)
 * with deterministic logging, error codes, and timeout enforcement.
 */
export var BrowserErrorCode;
(function (BrowserErrorCode) {
    BrowserErrorCode["BROWSER_TIMEOUT"] = "BROWSER_TIMEOUT";
    BrowserErrorCode["BROWSER_NAV_FAIL"] = "BROWSER_NAV_FAIL";
    BrowserErrorCode["BROWSER_JS_FAIL"] = "BROWSER_JS_FAIL";
    BrowserErrorCode["BROWSER_SCREENSHOT_FAIL"] = "BROWSER_SCREENSHOT_FAIL";
    BrowserErrorCode["BROWSER_CONTENT_FAIL"] = "BROWSER_CONTENT_FAIL";
})(BrowserErrorCode || (BrowserErrorCode = {}));
//# sourceMappingURL=IBrowserEngine.js.map