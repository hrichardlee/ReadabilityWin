// For an introduction to the Page Control template, see the following documentation:
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

        if (contentDiv.classList.contains("portraitMode")) {

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
        } else {
            resizingFunction = function (imgEl) {
                var origAspect = imgEl.width / imgEl.height;
                imgEl.width = document.defaultView.getComputedStyle(contentDiv, null).getPropertyValue("width").slice(0, -2);
                imgEl.height = imgEl.width / origAspect;
            }
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
                    if (dateMatched !== null && dateMatched.length >= 4) {
                        var rawDate = new Date(dateMatched[1], dateMatched[2], dateMatched[3]);
                        if (!isNaN(rawDate.getTime()))
                            document.getElementById("datepublished").innerText = "Published " + formatter.format(rawDate);
                    }

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

            GeneralLayout.renderTextSize = this.renderTextSize;
            this.renderTextSize();
            GeneralLayout.registerForTextSizeChanged(document.getElementById("content"));
            GeneralLayout.renderTextFont();

            GeneralLayout.createArticleTileNotification(currentArticle.title, currentArticle.leadImageUrl);
        },

        renderTextSize: function () {
            var fontSizes = [8, 10, 12, 14, 16, 20, 24, 32];
            var columnSizes = [255, 319, 382, 447, 511, 638, 766, 1021];
            var titleSectionWidth = 350; //hardcoded from CSS
            var leftMargin = 100;
            var rightMargin = 50;
            //columnSizes = [221, 277, 332, 387, 443, 553, 664, 885];

            var index = Number(GeneralLayout.getTextSize())

            var columnWidth = columnSizes[index - 1] * 1.05;
            var columnGap = columnWidth * 0.1;

            var contentEl = document.getElementById("content");
            var contentSectionEl = document.getElementById("contentSection");
            contentEl.style["font-size"] = fontSizes[index - 1] + "px";

            if (columnWidth * 2 + columnGap * 2 > window.innerWidth) {
                // portrait mode
                contentSectionEl.classList.add("portraitMode");
                contentSectionEl.classList.remove("landscapeMode");

                var maxWidth = window.innerWidth - leftMargin - rightMargin;
                if (columnWidth > maxWidth) {
                    columnWidth = maxWidth;
                } else {
                    leftMargin = ((window.innerWidth - columnWidth) * 2 / 3) - leftMargin;
                    contentSectionEl.style["margin-left"] = leftMargin + "px";
                }
                contentEl.style["width"] = columnWidth + "px";
            } else {
                // landscape mode
                contentSectionEl.classList.remove("portraitMode");
                contentSectionEl.classList.add("landscapeMode");

                contentEl.style["column-width"] = columnWidth + "px";
                contentEl.style["column-gap"] = columnGap + "px";
                contentEl.style["width"] = (columnWidth) + "px";

                contentSectionEl.style["margin-left"] = 0;
            }
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
            this.renderTextSize();
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
