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
            Windows.UI.Notifications.TileUpdateManager.createTileUpdaterForApplication().clear();
            // initialize appbar
            var appbar = document.getElementById("appbar");
            appbar.winControl.showCommands(["logoutButton", "refreshButton", "settingsButton"], false);
            appbar.winControl.hideCommands(["openWebButton", "showArchiveButton", "archiveArticleButton", "deleteArticleButton"], false);

            document.getElementById("logoutButton").onclick = this.logout.bind(this);
            //document.getElementById("showArchiveButton").winControl.label =
            //    ReadabilityAccount.getState("showArchive") ? "Hide archive" : "Show archive";
            document.getElementById("showArchiveButton").onclick = this.toggleShowArchive.bind(this);
            document.getElementById("refreshButton").onclick = this.refresh.bind(this);
            document.getElementById("settingsButton").onclick = function (e) {
                WinJS.UI.SettingsFlyout.showSettings("optionsSettingsFlyout", "/pages/optionsFlyout/optionsFlyout.html");
            }

            if (!ReadabilityAccount.isAuthorized()) {
                this.showLogin();
            } else {
                this.initialize();
            }
        },

        showLogin: function () {
            var usernameField = document.getElementById("loginUsername");
            var passwordField = document.getElementById("loginPassword");
            var loginErrorText = document.getElementById("loginErrorText");

            usernameField.oninput = function (e) { loginErrorText.innerText = ""; };
            passwordField.oninput = function (e) { loginErrorText.innerText = ""; };
            document.getElementById("loginModalDialog").style["display"] = "block";
            usernameField.focus();

            document.getElementById("loginButton").onclick = (function (e) {
                var username = usernameField.value;
                var password = passwordField.value;

                if (!username || !password) {
                    loginErrorText.innerText = "You must enter a username and password.";
                    usernameField.focus();
                } else {
                    GeneralLayout.showProgress();
                    ReadabilityAccount.login(username, password)
                        .done((function () {
                            document.getElementById("loginModalDialog").style["display"] = "none";
                            this.initialize();
                        }).bind(this),
                        function (err) {
                            var errorText = Errors.genericMessage("logging you in");
                            if (err instanceof XMLHttpRequest) {
                                if (err.status == 0) {
                                    errorText = Errors.networkFailureMessage("logging you in");
                                } else if (err.status == 401) {
                                    errorText = "Credentials were not valid.";
                                    passwordField.value = "";
                                }
                            }
                            loginErrorText.innerText = errorText;
                            GeneralLayout.hideProgress();
                            usernameField.focus();
                        });
                }
            }).bind(this);
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

        logout: function () {
            ReadabilityAccount.logout()
                .done((function () {
                    this.showLogin();
                }).bind(this), function (err) {
                    //don't worry about errors logging out--the only thing that will fail is resetting the cache
                });
        },

        toggleShowArchive: function () {
            ReadabilityAccount.editState("showArchive",
                !ReadabilityAccount.getState("showArchive"));

            document.getElementById("showArchiveButton").winControl.label =
                ReadabilityAccount.getState("showArchive") ? "Hide archive" : "Show archive";

            this.getDisplayBookmarks(true);
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
                            window.setImmediate(function () {
                                WinJS.Navigation.navigate("/pages/login/login.html");
                            });
                        } else if (err.status == 0) {
                            errorText = Errors.networkFailureMessage("getting your bookmarks");
                        }
                    }

                    GeneralLayout.textToast(errorText, true);
                    GeneralLayout.hideProgress()
                });
        },

        refresh: function () {
            this.getDisplayBookmarks(true);
        },

        unload: function () {
            document.getElementById("logoutButton").onclick = null;
            //document.getElementById("showArchiveButton").onclick = null;
            document.getElementById("refreshButton").onclick = null;
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
