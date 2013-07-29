// For an introduction to the Page Control template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232511
(function () {
    "use strict";

    // Variable to store the ShareOperation object
    var shareOperation = null;

    /// <summary>
    /// Handler executed on activation of the target
    /// </summary>
    /// <param name="eventArgs">
    /// Arguments of the event. In the case of the Share contract, it has the ShareOperation
    /// </param>
    function activatedHandler(eventObject) {
        // In this sample we only do something if it was activated with the Share contract
        if (eventObject.detail.kind === Windows.ApplicationModel.Activation.ActivationKind.shareTarget) {

            eventObject.setPromise(WinJS.UI.processAll());

            // We receive the ShareOperation object as part of the eventArgs
            shareOperation = eventObject.detail.shareOperation;

            // We queue an asychronous event so that working with the ShareOperation object does not
            // block or delay the return of the activation handler.
            WinJS.Application.queueEvent({ type: "shareready" });
        }
    }

    /// <summary>
    /// Handler executed when ready to share; handling the share operation should be performed
    /// outside the activation handler
    /// </summary>
    function shareReady(eventArgs) {
        ReadabilityAccount.loadState();
        if (ReadabilityAccount.isAuthorized()) {
            share();
        } else {
            WinJS.Application.addEventListener("loginComplete", function () {
                document.getElementById("login").style["display"] = "none";
                share();
            }.bind(this), false);
            document.getElementById("login").style["display"] = "block";
            WinJS.Application.queueEvent({ type: "loginDisplay" });
        }
    }

    function share() {
        if (shareOperation.data.contains(Windows.ApplicationModel.DataTransfer.StandardDataFormats.uri)) {
            GeneralLayout.showProgress();


            var x = document.querySelector("link[rel=\"stylesheet\"][href=\"" + "//Microsoft.WinJS.1.0/css/ui-light.css" + "\"]");

            shareOperation.data.getUriAsync().done(function (uri) {
                var linkName = "\"" + shareOperation.data.properties.title + "\" (" + uri.rawUri + ")";

                document.getElementById("message").innerText = "Bookmarking " + linkName;
                document.getElementById("continueButton").onclick = function () {
                    document.getElementById("continueButton").style["display"] = "none";
                    GeneralLayout.showProgress();
                    ReadabilityAccount.OAuthCall(ReadabilityAccount.bookmarksUrl,
                        "POST", "url=" + uri.rawUri, "access", [["url", uri.rawUri]]).done(function (d) {
                            GeneralLayout.hideProgress();
                            shareOperation.reportCompleted();
                        }, function (e) {
                            GeneralLayout.hideProgress();
                            var errorText;
                            var errorPrefix = "The following error occurred while adding the bookmark " + linkName + ": ";
                            if (e.status == 0)
                                errorText = errorPrefix + "network connection not found. Please connect to the internet and try again.";
                            else if (e.response && e.response.indexOf("Enter a valid URL.") !== -1)
                                errorText = errorPrefix + "the URL was not valid.";
                            else if (e.status === 409)
                                errorText = errorPrefix + "the URL has already been added";
                            else
                                errorText = "An error occurred while adding the bookmark " + linkName;

                            document.getElementById("message").innerText = errorText;
                        });
                }
                GeneralLayout.hideProgress();
            });
        } else {
            document.getElementById("message").innerText = "The selected content could not be shared with Readability (unofficial).";
        }
    }


    // Initialize the activation handler
    WinJS.Application.addEventListener("activated", activatedHandler, false);
    WinJS.Application.addEventListener("shareready", shareReady, false);
    WinJS.Application.start();
})();
