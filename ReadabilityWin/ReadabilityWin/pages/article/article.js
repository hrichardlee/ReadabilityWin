﻿// For an introduction to the Page Control template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232511
(function () {
    "use strict";

    var currentArticle;
    var archived = false;

    function shareArticle(e) {
        var data = e.request.data;
        data.properties.title = currentArticle.title;
        var selected = document.getSelection().toString();
        data.properties.description = selected;

        data.setUri(new Windows.Foundation.Uri(currentArticle.fullUrl));
    }

    function resetImages() {
        var contentDiv = document.getElementById("content");
        var imgs = contentDiv.getElementsByTagName("img");
        var resizingFunction = null;

        switch (Windows.UI.ViewManagement.ApplicationView.value) {
            case Windows.UI.ViewManagement.ApplicationViewState.fullScreenLandscape:
            case Windows.UI.ViewManagement.ApplicationViewState.filled:
                // assume these are in px
                var columnWidth = document.defaultView.getComputedStyle(contentDiv, null).getPropertyValue("column-width").slice(0, -2);  // for some bizarre reason, css sets column width as 400, actual is 550
                columnWidth = columnWidth - 50; // leave a bit of extra room
                var totalHeight = document.defaultView.getComputedStyle(contentDiv, null).getPropertyValue("height").slice(0, -2);
                // instead of using the total height, we want the actual total line height of the div
                var lineHeight = document.defaultView.getComputedStyle(contentDiv, null).getPropertyValue("line-height").slice(0, -2);
                var columnHeight = totalHeight - (totalHeight % lineHeight) - lineHeight; //minus an additional lineheight because there is a 0.5em margin on top/bottom

                resizingFunction = function (imgEl) {
                    var origAspect = imgEl.width / imgEl.height;
                    if (imgEl.width < 50 && imgEl.height < 50) {
                        // don't adjust small icons/logos
                    } else if (origAspect > columnWidth / columnHeight) {
                        imgEl.width = columnWidth;
                        imgEl.height = columnWidth / origAspect;
                    }
                    else {
                        imgEl.height = columnHeight;
                        imgEl.width = columnHeight * origAspect;
                    }
                }
                break;
            case Windows.UI.ViewManagement.ApplicationViewState.fullScreenPortrait:
            case Windows.UI.ViewManagement.ApplicationViewState.snapped:
                resizingFunction = function (imgEl) {
                    var origAspect = imgEl.width / imgEl.height;
                    imgEl.width = document.defaultView.getComputedStyle(contentDiv, null).getPropertyValue("width").slice(0, -2);
                    imgEl.height = imgEl.width / origAspect;
                }
                break;
        }

        for (var i = 0; i < imgs.length; i++) {
            resizingFunction(imgs[i]);
        }
    }

    WinJS.UI.Pages.define("/pages/article/article.html", {
        ready: function (element, options) {
            archived = false;
            currentArticle = options.articleSummary;
            document.getElementById("pageTitle").innerText = currentArticle.title;
            document.getElementById("headerPageTitle").innerText = currentArticle.title;

            GeneralLayout.showProgress();
            ReadabilityAccount.getArticleContent(currentArticle.bookmarkId)
                .then(function (content) {
                    document.getElementById("subtitle").innerText = currentArticle.subtitle;
                    document.getElementById("headerPageSubtitle").innerText = currentArticle.subtitle;
                    var dateMatched = /(\d\d\d\d)-(\d\d)-(\d\d)/.exec(currentArticle.datePublished);
                    var formatter = Windows.Globalization.DateTimeFormatting.DateTimeFormatter("year day month");
                    document.getElementById("datepublished").innerText = "Published " + formatter.format(new Date(dateMatched[1], dateMatched[2], dateMatched[3]));

                    document.getElementById("actualContent").innerHTML = content;
                    GeneralLayout.hideProgress();

                    // set up sharing: can't share until we download the article
                    var dtm = Windows.ApplicationModel.DataTransfer.DataTransferManager.getForCurrentView();
                    dtm.removeEventListener("datarequested", shareArticle);
                    dtm.addEventListener("datarequested", shareArticle);

                    resetImages();

                }, function (err) {
                    if (err instanceof Errors.diskError) {  //if it's a generic error, the homepage stuff should create the error
                        GeneralLayout.textToast(err.message, true);
                    }
                });

            GeneralLayout.renderThemeStyle();
            this.setAppBar();

            GeneralLayout.renderTextSize(document.getElementById("content"));
            GeneralLayout.registerForTextSizeChanged(document.getElementById("content"));
            GeneralLayout.renderTextFont();

            GeneralLayout.createArticleTileNotification(currentArticle.title, currentArticle.leadImageUrl);
        },

        setAppBar: function () {
            GeneralLayout.setAppBar({
                "openWebButton": function () {
                    window.open(currentArticle.fullUrl, "_blank");
                    window.focus();
                },
                "archiveArticleButton": this.archiveArticle.bind(this),
                "deleteArticleButton": this.deleteArticle.bind(this),
                "settingsButton": function (e) {
                    WinJS.UI.SettingsFlyout.showSettings("optionsSettingsFlyout", "/pages/optionsFlyout/optionsFlyout.html");
                }
            });

            GeneralLayout.setArchiveButton(true);

            document.getElementById("articleBackButton").onclick = function () {
                document.getElementById("appbar").winControl.hide();
                document.getElementById("topappbar").winControl.hide();
                WinJS.Navigation.navigate("/pages/home/home.html");
            };
        },

        archiveArticle: function () {
            var unarchive = archived;
            var url = ReadabilityAccount.apiRootUrl + "bookmarks/" + currentArticle.bookmarkId;
            var headers = {};
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            GeneralLayout.showProgress();
            var archivingText = unarchive ? "unarchiving" : "archiving";
            var archivedText = unarchive ? "unarchived" : "archived";
            var call = unarchive ? ReadabilityAccount.OAuthCall(url, "POST", "archive=0", "access", [["archive", "0"]], headers)
                        : ReadabilityAccount.OAuthCall(url, "POST", "archive=1", "access", [["archive", "1"]], headers);
            call.done(function (xhr) {
                if (xhr.status == 200) {
                    GeneralLayout.hideProgress();
                    GeneralLayout.textToast("The article \"" + currentArticle.title + "\" has been " + archivedText + ".");
                    ReadabilityAccount.archiveLocally(currentArticle.bookmarkId, unarchive)
                        .done(function () {
                            GeneralLayout.setArchiveButton(unarchive);
                            archived = !archived;
                        }, function (err) {
                            ReadabilityAccount.recordSynced(false);
                        });
                    Windows.UI.Notifications.TileUpdateManager.createTileUpdaterForApplication().clear();
                } else {
                    throw new Errors.readabilityError(archivingText + " the article \"" + currentArticle.title + "\"");
                }
            },
                function (err) {
                    GeneralLayout.hideProgress();
                    ReadabilityAccount.recordSynced(false);
                    var toastText = Errors.genericMessage(archivingText + " the article \"" + currentArticle.title + "\"");
                    if (err instanceof Errors.readabilityError) toastText = err.message;
                    else if (err instanceof XMLHttpRequest) toastText = Errors.networkFailureMessage(archivingText + " the article \"" + currentArticle.title + "\"");

                    GeneralLayout.textToast(toastText, true);
                });
        },

        deleteArticle: function () {
            var url = ReadabilityAccount.apiRootUrl + "bookmarks/" + currentArticle.bookmarkId;
            var headers = {};
            GeneralLayout.showProgress();
            ReadabilityAccount.OAuthCall(url, "DELETE").done(
                function (xhr) {
                    GeneralLayout.hideProgress();
                    GeneralLayout.textToast("The article \"" + currentArticle.title + "\" has been deleted.");
                    ReadabilityAccount.archiveLocally(currentArticle.bookmarkId)
                        .done(function () {
                        }, function (err) {
                            ReadabilityAccount.recordSynced(false);
                        });
                    Windows.UI.Notifications.TileUpdateManager.createTileUpdaterForApplication().clear();
                },
                function (err) {
                    GeneralLayout.hideProgress();
                    ReadabilityAccount.recordSynced(false);

                    var toastText = Errors.genericMessage("deleting the article \"" + currentArticle.title + "\"");
                    if (err instanceof Errors.readabilityError) toastText = err.message;
                    else if (err instanceof XMLHttpRequest) {
                        if (err.status === 404)
                            toastText = Errors.deletedAlreadyMessage(currentArticle.title);
                        else
                            toastText = Errors.networkFailureMessage("deleting the article \"" + currentArticle.title + "\"");
                    }

                    GeneralLayout.textToast(toastText, true);
                });
        },

        updateLayout: function (element, viewState, lastViewState) {
            resetImages();

            GeneralLayout.loadScrollState(document.getElementById("contentSection"));
        },

        unload: function () {
            document.getElementById("openWebButton").onclick = null;
            document.getElementById("archiveArticleButton").onclick = null;

            GeneralLayout.clearScrollState();
        }
    });
})();
