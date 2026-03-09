"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutCommand = logoutCommand;
const config_1 = require("../config");
function logoutCommand() {
    (0, config_1.clearConfig)();
    console.log("SUCCESS: Logged out. Local credentials have been cleared.");
    console.log("Run 'pking login' to authenticate again.");
}
