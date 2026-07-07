"use strict";
// Phase 27 — Ingestion Autonomy: Core type definitions
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileLockedError = void 0;
var FileLockedError = /** @class */ (function (_super) {
    __extends(FileLockedError, _super);
    function FileLockedError(message) {
        if (message === void 0) { message = "Manifest file is locked by another process"; }
        var _this = _super.call(this, message) || this;
        _this.name = "FileLockedError";
        return _this;
    }
    return FileLockedError;
}(Error));
exports.FileLockedError = FileLockedError;
