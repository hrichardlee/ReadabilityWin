(function () {
    "use strict";

    var themeStyles = { dark: "dark", light: "light" };

    var lightSheets = { "/pages/home/home.html": "/pages/home/homeLight.css" };

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
        if (lightSheets.hasOwnProperty(WinJS.Navigation.location)) {
            var lightStylesheetHref = lightSheets[WinJS.Navigation.location];
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

    

    function textToast(msg, isError) {
        var notif = Windows.UI.Notifications;
        var template = notif.ToastTemplateType.toastText01;
        var toastXml = notif.ToastNotificationManager.getTemplateContent(template);
        toastXml.getElementsByTagName("text")[0].appendChild(toastXml.createTextNode(msg));

        var toast = new notif.ToastNotification(toastXml);
        notif.ToastNotificationManager.createToastNotifier().show(toast);
    }

    function showProgress() {
        document.getElementById("mainProgress").style.display = "block";
    }

    function hideProgress() {
        document.getElementById("mainProgress").style.display = "none";
    }

    function printTime(time) {
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

    function setTextFont(value) {
        ReadabilityAccount.editState("fontFamily", value);
        if (onFontFamilyChanged) onFontFamilyChanged();
    }

    function getFontFamily() {
        var savedFont = ReadabilityAccount.getState("fontFamily");
        if (!savedFont) {
            savedFont = "Segoe";
            ReadabilityAccount.editState("fontFamily", savedFont);
        }
        return savedFont;
    }

    function setTextSize(value) {
        ReadabilityAccount.editState("textSize", value);
        if (onTextSizeChanged) onTextSizeChanged();
    }

    var onTextSizeChanged;
    var onFontFamilyChanged;

    function setOnTextSizeChanged(domEl) {
        onTextSizeChanged = function () {
            displayTextSize(domEl);
        }

        onFontFamilyChanged = function () {
            displayTextFont(domEl);
        }
    }

    function displayTextSize(domEl) {
        var cssName;
        switch (Number(getTextSize())) {
            case 1:
                cssName = "small";
                break;
            case 2:
                cssName = "medium";
                break;
            case 3:
                cssName = "large"
                break;
            case 4:
                cssName = "x-large";
                break;
            case 5:
                cssName = "xx-large";
                break;
        }
        if (domEl)
            domEl.style["font-size"] = cssName;
    }

    function displayTextFont(domEl) {
        domEl.style.fontFamily = getFontFamily();
    }

    function getTextSize() {
        return ReadabilityAccount.getState("textSize") || 2; //hardcoded default
    }

    WinJS.Namespace.define("GeneralLayout", {
        themeStyles: themeStyles,
        toggleThemeStyle: toggleThemeStyle,
        getThemeStyle: getThemeStyle,
        renderThemeStyle: renderThemeStyle,
        textToast: textToast,
        showProgress: showProgress,
        hideProgress: hideProgress,
        printTime: printTime,
        saveScrollState: saveScrollState,
        loadScrollState: loadScrollState,
        clearScrollState: clearScrollState,
        setTextSize: setTextSize,
        displayTextSize: displayTextSize,
        getTextSize: getTextSize,
        setOnTextSizeChanged: setOnTextSizeChanged,
        displayTextFont: displayTextFont,
        setTextFont: setTextFont,
        getFontFamily: getFontFamily
    });
})()