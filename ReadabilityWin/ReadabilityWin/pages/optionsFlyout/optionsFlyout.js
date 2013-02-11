﻿// For an introduction to the Page Control template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232511
(function () {
    "use strict";

    WinJS.UI.Pages.define("/pages/optionsFlyout/optionsFlyout.html", {
        // This function is called whenever a user navigates to this page. It
        // populates the page elements with the app's data.
        ready: function (element, options) {
            resetCacheButton.disabled = false;

            var themeStyleSwitch = document.getElementById("themeStyleSwitch").winControl;
            if (GeneralLayout.getThemeStyle() === GeneralLayout.themeStyles.light)
                themeStyleSwitch.checked = true;
            themeStyleSwitch.onchange = this.toggleThemeStyle;

            document.getElementById("resetCacheButton").onclick = this.resetCache.bind(this);

            var lastSyncedData = ReadabilityAccount.getState("lastSynced");
            document.getElementById("lastSyncedText").innerText =
                lastSyncedData ?
                    "Your account was last synced at: " + GeneralLayout.printTime(lastSyncedData.time)
                        + (lastSyncedData.success ? " and was successful" : " and was not successful")
                    : "Your account has not been synced yet"

            var textSizeSlider = document.getElementById("textSizeSlider");
            textSizeSlider.value = GeneralLayout.getTextSize();
            textSizeSlider.onchange = function (e) {
                GeneralLayout.setTextSize(textSizeSlider.value, document.getElementById("contentSection"));
            }
        },

        toggleThemeStyle: function (e) {
            GeneralLayout.toggleThemeStyle();
        },

        resetCache: function (e) {
            resetCacheButton.disabled = true;
            
            // first, go to the home screen
            ReadabilityAccount.deleteData()
                .done(function () {
                    WinJS.Navigation.navigate("/pages/home/home.html");
                }, function (err) {
                    // just eat errors here, it's just deleting the data that didn't work here
                    resetCacheButton.disabled = false;
                });
        },

        unload: function () {
        },

        updateLayout: function (element, viewState, lastViewState) {
            /// <param name="element" domElement="true" />

            // TODO: Respond to changes in viewState.
        }
    });
})();
