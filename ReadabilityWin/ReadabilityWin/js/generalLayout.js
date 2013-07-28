(function () {
    "use strict";

    ////
    //// Theme Styles

    var themeStyles = { dark: "dark", light: "light" };

    var _lightSheets = { "/pages/home/home.html": "/pages/home/homeLight.css" };

    function toggleThemeStyle() {
        var themeStyle = Windows.Storage.ApplicationData.current.roamingSettings.values["themeStyle"] || themeStyles.dark;
        themeStyle = themeStyle === themeStyles.dark ? themeStyles.light : themeStyles.dark;
        Windows.Storage.ApplicationData.current.roamingSettings.values["themeStyle"] = themeStyle;

        renderThemeStyle();
    }

    function _cssTagFromHref(href) {
        return document.querySelector("link[rel=\"stylesheet\"][href=\"" + href + "\"]");
    }

    // there's an option here to specify a css that should only render when it's light themed, with the default being the dark theme
    function renderThemeStyle() {
        var darkhref = "//Microsoft.WinJS.1.0/css/ui-dark.css"
        var lighthref = "//Microsoft.WinJS.1.0/css/ui-light.css"
        var darklink = _cssTagFromHref(darkhref);
        var lightlink = _cssTagFromHref(lighthref);

        if (lightlink && getThemeStyle() === themeStyles.dark)
            lightlink.setAttribute("href", darkhref);
        else if (darklink && getThemeStyle() === themeStyles.light)
            darklink.setAttribute("href", lighthref);

        // if they've specified a light css
        if (_lightSheets.hasOwnProperty(WinJS.Navigation.location)) {
            var lightStylesheetHref = _lightSheets[WinJS.Navigation.location];
            var lightStylesheetLink = _cssTagFromHref(lightStylesheetHref);
            if (lightStylesheetLink && getThemeStyle() === themeStyles.dark) {
                lightStylesheetLink.parentNode.removeChild(lightStylesheetLink);
            }
            else if (!lightStylesheetLink && getThemeStyle() === themeStyles.light) {
                var newLink = document.createElement("link");
                newLink.setAttribute("rel", "stylesheet");
                newLink.setAttribute("href", lightStylesheetHref);
                document.getElementsByTagName("head")[0].appendChild(newLink);
            }
        }
    }

    function getThemeStyle() {
        return Windows.Storage.ApplicationData.current.roamingSettings.values["themeStyle"];
    }

    
    ////
    //// Utility display functions

    function textToast(msg, isError) {
        var notif = Windows.UI.Notifications;
        var template = notif.ToastTemplateType.toastText01;
        var toastXml = notif.ToastNotificationManager.getTemplateContent(template);
        toastXml.getElementsByTagName("text")[0].appendChild(toastXml.createTextNode(msg));

        var toast = new notif.ToastNotification(toastXml);
        notif.ToastNotificationManager.createToastNotifier().show(toast);
    }

    function createArticleTileNotification(articleTitle, imgUrl) {
        var notif = Windows.UI.Notifications;
        var tileXml = notif.TileUpdateManager.getTemplateContent(notif.TileTemplateType.tileWideImageAndText01);
        tileXml.getElementsByTagName("text")[0].appendChild(tileXml.createTextNode(articleTitle));
        tileXml.getElementsByTagName("image")[0].setAttribute("src", imgUrl);
        tileXml.getElementsByTagName("image")[0].setAttribute("alt", "Article lead image");
        var squareTileXml = notif.TileUpdateManager.getTemplateContent(notif.TileTemplateType.tileSquareImage);
        squareTileXml.getElementsByTagName("image")[0].setAttribute("src", imgUrl);
        squareTileXml.getElementsByTagName("image")[0].setAttribute("alt", "Article lead image");
        var node = tileXml.importNode(squareTileXml.getElementsByTagName("binding")[0], true);
        tileXml.getElementsByTagName("visual")[0].appendChild(node);
        var tileNotif = new notif.TileNotification(tileXml);
        var currentTime = new Date();
        tileNotif.expirationTime = new Date(currentTime.getTime() + 3 * 24 * 60 * 1000);
        notif.TileUpdateManager.createTileUpdaterForApplication().update(tileNotif);
    }

    function showProgress() {
        document.getElementById("mainProgress").style.display = "block";
    }

    function hideProgress() {
        document.getElementById("mainProgress").style.display = "none";
    }

    function printTime(time) {
        if (!time)
            return "";

        time = new Date(time)

        var minutes = time.getMinutes();
        minutes = minutes < 10 ? "0" + minutes : minutes;
        var hours = time.getHours();
        var ampm = "";
        if (hours === 0) {
            hours = 12;
            ampm = "am";
        } else if (hours < 12) {
            ampm = "am";
        } else if (hours === 12) {
            ampm = "pm";
        } else if (hours > 12) {
            hours = hours - 12;
            ampm = "pm";
        }
        return "" + (time.getMonth() + 1) + "/" + time.getDate() + "/" + time.getFullYear() + " "
            + hours + ":" + minutes + " " + ampm;
    }
    
    var _allButtons = ["settingsButton", "logoutButton", "refreshButton", "openWebButton", "archiveArticleButton", "deleteArticleButton"];
    // configures the appbar to show buttons. buttons should be { <buttonId>: <buttonFunctionOnClick> }
    function setAppBar(buttons) {
        var appbar = document.getElementById("appbar");
        var buttonsToShow = [];
        for (var button in buttons) {
            if (buttons.hasOwnProperty(button)) {
                buttonsToShow.push(button);
                document.getElementById(button).onclick = buttons[button];
            }
        }
        var buttonsToHide = _allButtons.filter(function(x) { return !(buttonsToShow.indexOf(x) > -1); });
        appbar.winControl.hideCommands(buttonsToHide, false);
        appbar.winControl.showCommands(buttonsToShow, false);
    }
    
    // call this function with true to set the appbar button to archive
    function setArchiveButton(toArchive) {
        var archiveButton = document.getElementById("archiveArticleButton").winControl;
        archiveButton.label = toArchive ? "Archive this article" : "Unarchive this article";
        archiveButton.icon = toArchive ? "movetofolder" : "undo";
    }


    ////
    //// Scroll state

    function saveScrollState(domEl) {
        domEl.onscroll = function () {
            WinJS.Application.sessionState.scrollState =
                (Windows.UI.ViewManagement.ApplicationView.value == Windows.UI.ViewManagement.ApplicationViewState.fullScreenLandscape
                || Windows.UI.ViewManagement.ApplicationView.value == Windows.UI.ViewManagement.ApplicationViewState.filled)
                ? domEl.scrollLeft / domEl.scrollWidth
                : domEl.scrollTop / domEl.scrollHeight;
        }
    }

    function loadScrollState(domEl) {
        if (WinJS.Application.sessionState.scrollState) {
            if (Windows.UI.ViewManagement.ApplicationView.value == Windows.UI.ViewManagement.ApplicationViewState.fullScreenLandscape
                || Windows.UI.ViewManagement.ApplicationView.value == Windows.UI.ViewManagement.ApplicationViewState.filled)
                domEl.scrollLeft = WinJS.Application.sessionState.scrollState * domEl.scrollWidth;
            else
                domEl.scrollTop = WinJS.Application.sessionState.scrollState * domEl.scrollHeight;
        }
    }

    function clearScrollState() {
        WinJS.Application.sessionState.scrollState = null;
    }


    ////
    //// Text settings

    var _onTextSizeChanged;
    var _onFontFamilyChanged;

    var _defaultFontFamily = "Cambria";

    function getTextSize() {
        return ReadabilityAccount.getState("textSize") || 5; //hardcoded default
    }

    function getTextFont() {
        var savedFont = ReadabilityAccount.getState("fontFamily");
        if (!savedFont) {
            savedFont = _defaultFontFamily;
            ReadabilityAccount.editState("fontFamily", savedFont);
        }
        return savedFont;
    }

    function setTextSize(value) {
        ReadabilityAccount.editState("textSize", value);
        if (_onTextSizeChanged) _onTextSizeChanged();
    }

    function setTextFont(value) {
        ReadabilityAccount.editState("fontFamily", value);
        if (_onFontFamilyChanged) _onFontFamilyChanged();

        renderTextFont();
    }

    function registerForTextSizeChanged(domEl) {
        _onTextSizeChanged = function () {
            if (this.renderTextSize)
                this.renderTextSize(domEl);
        }.bind(this);
    }

    var renderTextSize;

    function renderTextFont() {
        document.getElementsByTagName("body")[0].style.fontFamily = getTextFont();
    }

    WinJS.Namespace.define("GeneralLayout", {
        // Theme Styles
        themeStyles: themeStyles,
        toggleThemeStyle: toggleThemeStyle,
        getThemeStyle: getThemeStyle,
        renderThemeStyle: renderThemeStyle,

        // Utillity
        textToast: textToast,
        createArticleTileNotification: createArticleTileNotification,
        showProgress: showProgress,
        hideProgress: hideProgress,
        printTime: printTime,
        setAppBar: setAppBar,
        setArchiveButton: setArchiveButton,

        // Scroll state
        saveScrollState: saveScrollState,
        loadScrollState: loadScrollState,
        clearScrollState: clearScrollState,

        // Text properties
        setTextSize: setTextSize,
        setTextFont: setTextFont,

        renderTextSize: renderTextSize,
        renderTextFont: renderTextFont,

        getTextSize: getTextSize,
        getTextFont: getTextFont,

        registerForTextSizeChanged: registerForTextSizeChanged
    });
})()