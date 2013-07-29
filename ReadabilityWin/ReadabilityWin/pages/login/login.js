// For an introduction to the Page Control template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232511
(function () {
    "use strict";

    WinJS.Application.addEventListener("loginDisplay", loginDisplay, false);

    function loginDisplay(e) {
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
