const {Cc, Ci} = require("chrome");
const eps = Cc['@mozilla.org/embedcomp/prompt-service;1'].getService(Ci.nsIPromptService); //embeded prompt service
/////listen for new window open
/////set openintab to true
/////clean up

exports.main = function(options, callbacks) {
    const winUtils = require("sdk/deprecated/window-utils");
    const utils = require('sdk/window/utils');
    const tabs = require("sdk/tabs");
    const timers = require("sdk/timers");
    //not using a singleton here for better compatibility.
    //(other addons might have different code for different window)
    utils.windows().forEach(function (browser_window){
        var searchbar = browser_window.document.getElementById("searchbar");
        // console.log(searchbar.handleSearchCommand.toString());

        var ori = searchbar.handleSearchCommand.toString();
        var patched = ori.replace("function handleSearchCommand(aEvent)", "function (aEvent)");
        patched = patched.replace("this.doSearch(textValue, where);",
            "if (tabs.activeTab.url == \"about:newtab\") {\n \
                where = \"current\";\n \
            }\n \
            this.doSearch(textValue, where);");
        patched = "("+patched+")";
        searchbar.handleSearchCommand = eval(patched); //eval here should be fine.

        if (browser_window.Omnibar !== undefined){ // patch Omnibar if it exist
            ori = browser_window.Omnibar.handleSearchQuery.toString();
            patched = ori.replace("openintab = currentBrowser.currentURI.spec != \"about:blank\";",
                "openintab = currentBrowser.currentURI.spec != \"about:blank\" && currentBrowser.currentURI.spec != \"about:newtab\";");

            patched = "(function(url, event){ \
            var log = function(o) Cc[\"@mozilla.org/consoleservice;1\"].getService(Ci.nsIConsoleService).logStringMessage(o+'');\n \
            var O = window.Omnibar;\n \
            return (" + patched + ")(url, event)\n})";
            browser_window.Omnibar.handleSearchQuery = browser_window.eval(patched); //eval here should be fine.        
        }
    });
};

exports.onUnload = function(reason) {
    if (reason == "disable"){
        eps.alert(null,"New Tab Overwrite","Please restart Firefox to completly disable/uninstall New Tab Overwrite");
    }
};