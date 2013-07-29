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

                    this.renderTextSize();

                }.bind(this), function (err) {
                    if (err instanceof Errors.diskError) {  //if it's a generic error, the homepage stuff should create the error
                        GeneralLayout.textToast(err.message, true);
                    }
                });

            GeneralLayout.renderThemeStyle();
            this.setAppBar();

            GeneralLayout.renderTextSize = this.renderTextSize;
            GeneralLayout.registerForTextSizeChanged();
            GeneralLayout.renderTextFont();

            GeneralLayout.createArticleTileNotification(currentArticle.title, currentArticle.leadImageUrl);
        },

        renderTextSize: function () {
            var fontSizes = [8, 10, 12, 14, 16, 20, 24, 32];
            var columnSizes = [255, 319, 382, 447, 511, 638, 766, 1021];

            var index = Number(GeneralLayout.getTextSize())

            var columnWidth = columnSizes[index - 1] * 1.05;
            var columnGap = columnWidth * 0.1;

            var contentEl = document.getElementById("content");
            var contentSectionEl = document.getElementById("contentSection");
            var titleSectionEl = document.getElementById("titleSection");
            contentEl.style["font-size"] = fontSizes[index - 1] + "px";

            var portraitMode = GeneralLayout.getForcePortrait() || (columnWidth * 2 + columnGap * 2 > window.innerWidth);
            if (portraitMode) {
                // portrait mode
                contentSectionEl.classList.add("portraitMode");

                var minLeftMargin = 20; //hardcoded default
                var leftMargin = (window.innerWidth - columnWidth) * 2 / 3;
                if (leftMargin < minLeftMargin) {
                    leftMargin = minLeftMargin;
                    columnWidth = window.innerWidth - (leftMargin * 2);
                }
                contentSectionEl.style["padding-left"] = leftMargin + "px";
                contentSectionEl.style["width"] = (window.innerWidth - leftMargin) + "px";
                contentEl.style["width"] = columnWidth + "px";
                titleSectionEl.style["width"] = columnWidth + "px";

                //undo landscape mode stuff
                contentSectionEl.classList.remove("landscapeMode");
            } else {
                // landscape mode
                contentSectionEl.classList.add("landscapeMode");

                contentEl.style["column-width"] = columnWidth + "px";
                contentEl.style["column-gap"] = columnGap + "px";
                contentEl.style["width"] = (columnWidth) + "px";

                //undo portrait mode stuff
                contentSectionEl.classList.remove("portraitMode");
                contentSectionEl.style["padding-left"] = 0;
                contentSectionEl.style["width"] = "auto";

                titleSectionEl.style["width"] = "400px"; //hardcoded default
            }


            // resize images
            var maxImgWidth = columnWidth - 50; // leave a bit of extra room
            var columnHeight = window.innerHeight - 100; //100 is hardcoded from css
            var maxImgHeight = portraitMode ? window.innerHeight - 25 : columnHeight - 50;

            var imgResizingFunction = function (imgEl) {
                var origAspect = imgEl.width / imgEl.height;
                if (imgEl.width < 50 && imgEl.height < 50) {
                    // don't adjust small icons/logos
                } else if (origAspect > maxImgWidth / maxImgHeight) {
                    imgEl.width = maxImgWidth;
                    imgEl.height = maxImgWidth / origAspect;
                }
                else {
                    imgEl.height = maxImgHeight;
                    imgEl.width = maxImgHeight * origAspect;
                }
            }

            // resize images now
            var imgs = contentEl.getElementsByTagName("img");
            for (var i = 0; i < imgs.length; i++) {
                imgResizingFunction(imgs[i]);
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
            GeneralLayout.loadScrollState(document.getElementById("contentSection"));
        },

        unload: function () {
            document.getElementById("openWebButton").onclick = null;
            document.getElementById("archiveArticleButton").onclick = null;

            GeneralLayout.clearScrollState();
        }
    });
})();
