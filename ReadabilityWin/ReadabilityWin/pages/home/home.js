// super big hack (gets called from img[onload], but there's no other way for it to be performant...
function onImgLoad(imgEl) {
    var idealWidth = 175;
    var idealHeight = 175;

    if (imgEl.width / imgEl.height < idealWidth / idealHeight) {
        imgEl.width = idealWidth;
        imgEl.removeAttribute("height");
    } else {
        imgEl.height = idealHeight;
        imgEl.removeAttribute("width");
    }
}

(function () {
    "use strict";

    var bookmarksData;
    var savedViewState = Windows.UI.ViewManagement.ApplicationViewState.fullScreenLandscape;

    WinJS.UI.Pages.define("/pages/home/home.html", {
        ready: function (element, options) {
            GeneralLayout.setAppBar({
                "logoutButton": function () {
                    ReadabilityAccount.logout()
                        .done((function () {
                            document.getElementById("appbar").winControl.hide()
                            this.showLogin();
                        }).bind(this), function (err) {
                            //don't worry about errors logging out--the only thing that will fail is resetting the cache
                        });
                }.bind(this),
                "refreshButton": function () {
                    this.getDisplayBookmarks(true);
                }.bind(this),
                "settingsButton": function (e) {
                    WinJS.UI.SettingsFlyout.showSettings("optionsSettingsFlyout", "/pages/optionsFlyout/optionsFlyout.html");
                }
            });

            if (!ReadabilityAccount.isAuthorized()) {
                this.showLogin();
            } else {
                this.initialize();
            }

            Windows.UI.Notifications.TileUpdateManager.createTileUpdaterForApplication().clear();

            GeneralLayout.renderTextFont();
        },

        showLogin: function () {

            WinJS.Application.addEventListener("loginComplete", function () {
                document.getElementById("login").style["display"] = "none";
                this.initialize();
            }.bind(this), false);
            document.getElementById("login").style["display"] = "block";
            WinJS.Application.queueEvent({ type: "loginDisplay" });
        },

        initialize: function () {
            this.correctLayout();
            GeneralLayout.renderThemeStyle();

            var listView = document.getElementById("readingList").winControl;
            listView.oniteminvoked = this.itemInvoked.bind(this);

            this.getDisplayBookmarks(false);
        },

        itemInvoked: function (args) {
            WinJS.Navigation.navigate("/pages/article/article.html", {
                articleSummary: bookmarksData[args.detail.itemIndex]
            });
        },

        getDisplayBookmarks: function (refresh) {
            GeneralLayout.showProgress();
            ReadabilityAccount.getBookmarks(refresh).done(
                function (items) {
                    items.allOpsPromise
                        .done(function () {
                            ReadabilityAccount.recordSynced(true);
                            GeneralLayout.hideProgress()
                        },
                        function (err) {
                            ReadabilityAccount.recordSynced(false);
                            GeneralLayout.hideProgress()
                            GeneralLayout.textToast(Errors.genericMessage("downloading articles"), true);
                        });

                    items.leadImagesPromise.done(function (status) {
                        if (status != "alreadyReady" && WinJS.Navigation.location === "/pages/home/home.html") {
                            var imgs = document.getElementsByTagName("img");
                            for (var i = 0; i < imgs.length; i++) {
                                imgs[i].src = imgs[i].src + "?refresh";
                            }
                        }
                    }, function (err) {
                        ReadabilityAccount.recordSynced(false);
                        GeneralLayout.textToast(Errors.genericMessage("downloading images"), true);
                    });

                    if (WinJS.Navigation.location === "/pages/home/home.html") {
                        // save in the global variable
                        // some bookmarks will be hidden, don't show those
                        bookmarksData = items.bookmarksData
                            .filter(function (b) {
                                return !b.hide;
                            });
                        var bookmarksDataList = new WinJS.Binding.List(bookmarksData);
                        // then display the bookmarks
                        var listView = document.getElementById("readingList").winControl;
                        listView.itemDataSource = bookmarksDataList.dataSource;
                        listView.itemTemplate = document.querySelector(".itemtemplate");
                    }
                },
                function (err) {
                    ReadabilityAccount.recordSynced(false);
                    var errorText = Errors.genericMessage("getting your bookmarks");
                    if (err instanceof XMLHttpRequest) {
                        // if we're unauthorized, go to login
                        if (err.status === 401) {
                            this.showLogin();
                        } else if (err.status == 0) {
                            errorText = Errors.networkFailureMessage("getting your bookmarks");
                        }
                    }

                    GeneralLayout.textToast(errorText, true);
                    GeneralLayout.hideProgress()
                }.bind(this));
        },

        updateLayout: function (element, viewState, lastViewState) {
            savedViewState = viewState;
            this.correctLayout();
        },

        correctLayout: function () {
            switch (Windows.UI.ViewManagement.ApplicationView.value) {
                case Windows.UI.ViewManagement.ApplicationViewState.snapped:
                case Windows.UI.ViewManagement.ApplicationViewState.fullScreenPortrait:
                    document.getElementById("readingList").winControl.layout = new WinJS.UI.ListLayout();
                    break;
                case Windows.UI.ViewManagement.ApplicationViewState.filled:
                case Windows.UI.ViewManagement.ApplicationViewState.fullScreenLandscape:
                    document.getElementById("readingList").winControl.layout = new WinJS.UI.GridLayout();
                    break;
            }
        }
    });
})();
