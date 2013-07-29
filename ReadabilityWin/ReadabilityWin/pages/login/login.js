// For an introduction to the Page Control template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232511
(function () {
    "use strict";

    WinJS.Application.addEventListener("loginDisplay", loginDisplay, false);

    function loginDisplay(e) {
        // stylesheet needs to get added dynamically so it doesn't mess up the host page
        var styleSheetDiv = document.createElement("div");
        styleSheetDiv.innerHTML = toStaticHTML("<link href=\"//Microsoft.WinJS.1.0/css/ui-dark.css\" rel=\"stylesheet\" />");
        document.getElementById("loginModalDialog").appendChild(styleSheetDiv);

        var usernameField = document.getElementById("loginUsername");
        var passwordField = document.getElementById("loginPassword");
        var loginErrorText = document.getElementById("loginErrorText");

        usernameField.oninput = function (e) { loginErrorText.innerText = ""; };
        passwordField.oninput = function (e) { loginErrorText.innerText = ""; };
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
                        styleSheetDiv.parentNode.removeChild(styleSheetDiv);
                        WinJS.Application.queueEvent({ type: "loginComplete" });
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
    }
})();
