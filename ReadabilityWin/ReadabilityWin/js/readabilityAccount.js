(function () {
    "use strict";

    // Public constants
    var rootUrl = "https://readability.com";
    var apiRootUrl = "https://readability.com/api/rest/v1/";
    var bookmarksUrl = apiRootUrl + "bookmarks";

    // Private variables

    var _accessTokenEndpoint = apiRootUrl + "oauth/access_token/";

    var _leadImagesFolder = "readability-lead-images";
    var _bookmarkFolderPrefix = "readability-art-";

    var _oauthRequestToken = "";
    var _oauthRequestSecret = "";

    var _articlePromises = {};
    var _bookmarksData = {};

    // All state that needs to roam gets put here
    var stateBag = {};


    ////
    //// Utility functions

    function _parseQueryString(queryStr) {
        var params = {}
        queryStr.split("&").map(function (item) {
            params[item.substr(0, item.indexOf("="))] = item.substr(item.indexOf("=") + 1);
        });
        return params;
    }

    function _unescapeUnicode(s) {
        var fakeDiv = document.createElement("div");
        fakeDiv.innerHTML = s;
        var toReturn = fakeDiv.innerText;
        fakeDiv.removeNode();
        return toReturn;
    }

    // Returns an xhr promise
    // url and method are required
    // params must be in the form [[name, value], ...], default is no extra params.
    // urlencoded params in post body must also be passed in the params parameter
    // tokenType can be "request", "access", or "none". Default is "access"
    // content headers must be in the form { header-name: header-value }
    function OAuthCall(url, method, data, tokenType, params, contentHeaders) {
        params = params || [];
        tokenType = tokenType || "access";
        data = data || "";
        contentHeaders = contentHeaders || {};

        var tokenSecret;
        switch (tokenType) {
            case "none":
                tokenSecret = "";
                break;
            case "request":
                tokenSecret = _oauthRequestSecret;
                params.push(["oauth_token", _oauthRequestToken]);
                break;
            case "access":
                tokenSecret = stateBag.oauthAccessSecret;
                if (!isAuthorized())
                    return WinJS.Promise.wrapError("uh oh");
                params.push(["oauth_token", stateBag.oauthAccessToken]);
                break;
            default:
                return WinJS.Promise.wrapError("bad token type");
        }

        var accessor = {
            consumerSecret: ReadabilityAccountKeys.consumerSecret,
            tokenSecret: tokenSecret
        }
        var message = {
            action: url,
            method: method,
            parameters: params.concat([["oauth_consumer_key", ReadabilityAccountKeys.consumerKey],
                ["oauth_signature_method", "HMAC-SHA1"],
                ["oauth_timestamp", ""],
                ["oauth_nonce", ""],
                ["oauth_signature", ""],
                ["oauth_version", "1.0"]])
        };
        OAuth.setTimestampAndNonce(message);

        OAuth.SignatureMethod.sign(message, accessor);

        contentHeaders.Authorization = OAuth.getAuthorizationHeader(url, OAuth.getParameterMap(message.parameters));

        return WinJS.xhr({
            url: url,
            type: method,
            headers: contentHeaders,
            data: data
        });
    }

    ////
    //// Authentication

    // Returns a Promise<bool>. True means that we can continue, false means that we need to try again,
    // and an error means we should have been able to get tokens but we couldn't
    function login(username, password) {
        return OAuthCall(_accessTokenEndpoint, "POST", "", "none",
                [["x_auth_username", username],
                ["x_auth_password", password],
                ["x_auth_mode", "client_auth"]])
            .then(function (xhr) {
                var returnedParams = _parseQueryString(xhr.responseText);
                if (!returnedParams.hasOwnProperty("oauth_token") || !returnedParams.hasOwnProperty("oauth_token_secret"))
                    err("Bad params error"); // TODO Fix this?

                stateBag.oauthAccessToken = returnedParams.oauth_token;
                stateBag.oauthAccessSecret = returnedParams.oauth_token_secret;

                _saveState();
            });
    }

    function isAuthorized() {
        return stateBag.oauthAccessSecret && stateBag.oauthAccessToken;
    }

    // returns nothing
    function logout() {
        _oauthRequestSecret = "";
        _oauthRequestToken = "";
        _saveState();
        return deleteData(true);
    }


    ////
    //// Functionality: Loading bookmarks and articles, archiving

    // sets the _bookmarksData private variable and also returns Promise<bookmarksData>
    // returns a Promise<bookmarksData, Promise<leadImagesOps>, Promise<allOps>}>
    function getBookmarks(refresh) {
        if (refresh)
            return _downloadBookmarks();
        else {
            return _loadData()
                .then(function () { // returning successfully means we got an object
                    return WinJS.Promise.wrap({
                        bookmarksData: (_bookmarksData),
                        leadImagesPromise: WinJS.Promise.wrap("alreadyReady"),
                        allOpsPromise: WinJS.Promise.wrap(null)
                    });
                }, function (err) {    // error, means we need to re-download
                    return _downloadBookmarks();
                });
        }
    }

    function _downloadBookmarks() {
        return _downloadBookmarksHelper().then(function (allBookmarks) {
            _bookmarksData = allBookmarks;

            var saveDataPromise = _saveData();
            var leadImagesPromise = _downloadLeadImages(_bookmarksData);
            var articlesPromise = _downloadArticles()
                .then(function () {
                    _cleanRemovedArticles(_bookmarksData)
                });

            var allOpsPromise = WinJS.Promise.join([saveDataPromise, leadImagesPromise, articlesPromise]);
            return {
                bookmarksData: _bookmarksData,
                leadImagesPromise: leadImagesPromise,
                allOpsPromise: allOpsPromise
            };
        });
    }

    function _downloadBookmarksHelper(){
        var completeFunc, errFunc, progressFunc;
        var finalPromise = new WinJS.Promise(function (c, e, p) {
            completeFunc = c;
            errFunc = e;
            progressFunc = p;
        });
        
        // calls complete when it's done
        function _downloadBookmarksPageInner(prevBookmarks, page) {
            var url = ReadabilityAccount.bookmarksUrl + "?archive=0&per_page=20&page=" + page;
            return ReadabilityAccount.OAuthCall(
                url, "GET", "", "access", [],
                { "If-Modified-Since": "Mon, 27 Mar 1972 00:00:00 GMT" })
                .then(function (xhr) {
                    var responseObj = JSON.parse(xhr.response);
                    var thisPageBookmarksData = responseObj.bookmarks.map(function (b) {
                        var toReturn = {
                            title: b.article.title,
                            author: b.article.author || "",
                            domain: b.article.domain || "",
                            datePublished: b.article.date_published || "",
                            articleHref: b.article_href,
                            leadImageSrc: b.article.lead_image_url,
                            leadImageUrl: b.article.lead_image_url
                                ? ("ms-appdata:///local/"
                                    + _leadImagesFolder + "/"
                                    + _filenameFromSrc(b.article.lead_image_url))
                                : "/images/placeholder.png",
                            excerpt: _unescapeUnicode(b.article.excerpt),
                            bookmarkId: b.id,
                            fullUrl: b.article.url,
                            hide: false
                        };
                        toReturn.subtitle = toReturn.author
                            ? toReturn.author + " | " + toReturn.domain
                            : toReturn.domain;
                        return toReturn;
                    });
                    var allBookmarks = prevBookmarks.concat(thisPageBookmarksData);
                    // TODO fix this constant
                    if (thisPageBookmarksData.length >= 20)
                        _downloadBookmarksPageInner(allBookmarks, page + 1);
                    else
                        completeFunc(allBookmarks);
                }, function (err) {
                    if (page != 1 && err.status == 404)
                        // this means the number of bookmarks was a multiple of the per_page
                        completeFunc(prevBookmarks);
                    else
                        errFunc(err);
                });
        }
        _downloadBookmarksPageInner([], 1);
        return finalPromise;
    }
    
    function _downloadLeadImages(bookmarksData) {
        return Windows.Storage.ApplicationData.current.localFolder.createFolderAsync(
            _leadImagesFolder,
            Windows.Storage.CreationCollisionOption.openIfExists
        ).then(function (folder) {
            var leadImageWritingPromises = bookmarksData.filter(function (b) {
                return b.leadImageSrc;
            }).map(function (b) {
                return folder.createFileAsync(
                    _filenameFromSrc(b.leadImageSrc),
                    Windows.Storage.CreationCollisionOption.failIfExists
                ).then(function(file) {
                    return _saveImageToFile(b.leadImageSrc, file);
                }, function (err) {
                    // do nothing--if the file already exists
                });
            });
            return WinJS.Promise.join(leadImageWritingPromises);
        });
    }

    function _cleanRemovedArticles(bookmarksData) {
        var bookmarkIds = bookmarksData.map(function (b) { return b.bookmarkId; });

        var localFolder = Windows.Storage.ApplicationData.current.localFolder;
        return localFolder.createFolderQuery().getFoldersAsync()
            .then(function (folders) {
                var cleanFolderPromises = folders.map(function (folder) {
                    if (folder.name.indexOf("readability-art-") === 0) {
                        var bookmarkId = folder.name.slice("readability-art-".length);
                        if (bookmarkIds.indexOf(Number(bookmarkId)) === -1) {
                            _deleteFolderContents(folder)
                                .then(function () {
                                    return folder.deleteAsync();
                                });
                        }
                    }
                    return "";
                });

                return WinJS.Promise.join(cleanFolderPromises);
            });
    }

    function _getFolderFromBookmark(bookmarkId) {
        return _bookmarkFolderPrefix + bookmarkId;
    }

    // returns a promise<html content>. throws a disk error only if we don't have the promise and we look on disk and can't find it
    function getArticleContent(bookmarkId) {
        if (_articlePromises.hasOwnProperty(bookmarkId)) {
            // if we still have the promise, return that
            return _articlePromises[bookmarkId];
        } else {
            // if we don't have the promise, check the file on disk
            return Windows.Storage.ApplicationData.current.localFolder.getFolderAsync(_getFolderFromBookmark(bookmarkId))
                .then(function (folder) {
                    return folder.getFileAsync("content.html");
                }).then(function (file) {
                    return Windows.Storage.FileIO.readTextAsync(file);
                }, function (err) {
                    throw new Errors.diskError("loading your articles");
                });
        }
    }

    // url is a string, file is a file promise
    function _saveImageToFile(url, file) {
        return WinJS.Promise.join(
            {
                fileStream: file.openAsync(Windows.Storage.FileAccessMode.readWrite),
                data: WinJS.xhr({ url: url, responseType: "blob" })
            })
            .then(function (items) {
                var imgStream = items.data.response.msDetachStream();
                // this only closes the output stream
                return WinJS.Promise.join({
                    imgStream: imgStream,
                    copyOp: Windows.Storage.Streams.RandomAccessStream.copyAndCloseAsync(imgStream, items.fileStream)
                });
            }).then(function (items) {
                items.imgStream.close();
                // doesn't return anything, implicitly indicates success when it returns
            }, function (err) {
                // err.fileStream will be an error if the image file already exists
                debugger;
            });
    }

    // requires call to getBookmarks first
    // returns a promise that finishes when everything is done
    function _downloadArticles() {
        var writingPromisesArray = _bookmarksData.map(function (b) {
            var url = rootUrl + b.articleHref;
            var folderName = _getFolderFromBookmark(b.bookmarkId);

            var localFolder = Windows.Storage.ApplicationData.current.localFolder;
            return localFolder.createFolderAsync(
                folderName,
                Windows.Storage.CreationCollisionOption.failIfExists
            ).then(function (folder) {
                var origContentPromise = OAuthCall(url, "GET")
                    .then(function (xhr) {
                        var responseObj = JSON.parse(xhr.response);
                        return toStaticHTML(responseObj.content);
                    });
                var modContentPromise = origContentPromise
                    .then(function (content) {
                        // now replace image srcs
                        var hiddenContent = document.createElement("div");
                        hiddenContent.innerHTML = content;
                        var imgs = hiddenContent.getElementsByTagName("img");
                        for (var i = 0; i < imgs.length; i++) {
                            imgs[i].src = "ms-appdata:///local/" + folderName + "/" + _filenameFromSrc(imgs[i].src);
                        }

                        var toReturn = hiddenContent.innerHTML;
                 
                        hiddenContent.removeNode(true);
                        return toReturn;
                    });

                // store the content promise--this is all we return at first
                _articlePromises[b.bookmarkId] = modContentPromise;

                // returns a joined promise for writing all the images
                var imgPromises = origContentPromise
                    .then(function (content) {
                        // find and download all images. it sucks that we do the dom parsing twice, but whatever
                        var hiddenContent = document.createElement("div");
                        hiddenContent.innerHTML = content;
                        var imgs = hiddenContent.getElementsByTagName("img");
                        var imgSrcs = {};
                        var imgWritingPromises = [];
                        for (var i = 0; i < imgs.length; i++) {
                            if (!imgSrcs.hasOwnProperty(imgs[i].src)) {
                                imgSrcs[imgs[i].src] = true;
                                // this is a promise that writes image to the file
                                var filePromise = folder.createFileAsync(
                                    _filenameFromSrc(imgs[i].src),
                                    Windows.Storage.CreationCollisionOption.replaceExisting
                                );
                                var imgWritingPromise = WinJS.Promise.join({ file: filePromise, url: imgs[i].src })
                                    .then(function (items) {
                                        return _saveImageToFile(items.url, items.file);
                                    });
                                imgWritingPromises.push(imgWritingPromise)
                            }
                        }

                        return WinJS.Promise.join(imgWritingPromises);
                    });

                var htmlFilePromise = folder.createFileAsync(
                            "content.html",
                            Windows.Storage.CreationCollisionOption.replaceExisting
                    );
                var htmlWritingPromise = WinJS.Promise.join({ file: htmlFilePromise, content: modContentPromise })
                    .then(function (items) {
                        Windows.Storage.FileIO.writeTextAsync(items.file, items.content); // potential bug: if this never works, then try 
                        return items.content;
                    });

                // finally, join all the writing promises:
                return WinJS.Promise.join({ html: htmlWritingPromise, imgs: imgPromises })
            }, function (err) {
                // failed to create folder, so it exists already, just let it go
            });
        });

        return WinJS.Promise.join(writingPromisesArray);
    }

    function archiveLocally(currBookmarkId, unarchive) {
        _bookmarksData
            .filter(function (b) {
                return b.bookmarkId === currBookmarkId;
            })
            .forEach(function (b) {
                b.hide = !unarchive;
            });
        return _saveData();
        // this just hides the bookmark -- all the data is still there, but will get removed next time
    }


    ////
    //// State

    function _filenameFromSrc(src) {
        var fn = src.replace(/[\?\[\]\\/=\+<>:;",\*|\^]/g, "-");
        return fn.length > 75 ? fn.slice(-75) : fn;
    }

    function editState(name, value) {
        stateBag[name] = value;
        _saveState();
        return stateBag[name];
    }

    function getState(name) {
        return stateBag[name];
    }

    function _saveState() {
        // potential optimization where we only save one kind of state at a time
        Windows.Storage.ApplicationData.current.roamingSettings.
            values["readabilityState"] = JSON.stringify(stateBag);
    }

    function loadState() {
        var roamingSettings = Windows.Storage.ApplicationData.current.roamingSettings;
        stateBag = JSON.parse(roamingSettings.values["readabilityState"] || "{}");
    }

    // returns a promise that tells you when the file is done being written
    function _saveData() {
        return Windows.Storage.ApplicationData.current.localFolder.createFileAsync(
            "readabilityBookmarksData.json",
            Windows.Storage.CreationCollisionOption.replaceExisting
        ).then(function (file) {
            Windows.Storage.FileIO.writeTextAsync(file, JSON.stringify(_bookmarksData));
        });
    }

    // returns a promise that tells you when it's done
    function _loadData() {
        return Windows.Storage.ApplicationData.current.localFolder.getFileAsync("readabilityBookmarksData.json")
            .then(function (file) {
                return Windows.Storage.FileIO.readTextAsync(file);
            })
            .then(function (fileContents) {
                _bookmarksData = JSON.parse(fileContents);
            });
    }

    function deleteData(deleteAllState) {
        if (deleteAllState) {
            stateBag = {};
            _saveState();
        } else {
            delete stateBag["lastSynced"];
        }
        var folder = Windows.Storage.ApplicationData.current.localFolder;
        return _deleteFolderContents(Windows.Storage.ApplicationData.current.localFolder);
    }

    // takes a folder (not a promise) and returns a promise that finishes when everything is deleted
    function _deleteFolderContents(folder, deleteSelf) {
        var filePromises = folder.createFileQuery().getFilesAsync()
            .then(function (files) {
                var deleteFilePromises = [];
                files.forEach(function (file) {
                    deleteFilePromises.push(
                        file.deleteAsync().then(function(){
                        }, function (err) {
                            // debugger;
                            // some times files just won't delete themselves...
                        })
                    );
                });
                return WinJS.Promise.join(deleteFilePromises);
            });
        var folderPromises = folder.createFolderQuery().getFoldersAsync()
            .then(function (folders) {
                var deleteFolderPromises = [];
                folders.forEach(function (folder) {
                    var deleteFolderPromise = _deleteFolderContents(folder)
                        .then(function () {
                            return folder.deleteAsync().then(function () {
                            }, function (err) {
                                //debugger;
                                // some times files just won't delete themselves...
                            });
                        })
                    deleteFolderPromises.push(deleteFolderPromise);
                });
                return WinJS.Promise.join(deleteFolderPromises);;
            });
        return WinJS.Promise.join([filePromises, folderPromises]);
    }

    function recordSynced(success) {
        editState("lastSynced", { success: success, time: new Date() });
    }

    WinJS.Namespace.define("ReadabilityAccount", {
        // Constants
        rootUrl: rootUrl,
        apiRootUrl: apiRootUrl,
        bookmarksUrl: bookmarksUrl,

        // Utility
        OAuthCall: OAuthCall,

        // Authentication
        login: login,
        isAuthorized: isAuthorized,
        logout: logout,

        // Functionality
        getBookmarks: getBookmarks,
        getArticleContent: getArticleContent,
        archiveLocally: archiveLocally,

        // State
        loadState: loadState,
        editState: editState,
        getState: getState,
        deleteData: deleteData,
        recordSynced: recordSynced
    });
})()