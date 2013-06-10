(function () {
    "use strict";

    function genericMessage(message) {
        return "Something went wrong while " + message + ".";
    }

    function networkFailureMessage(message) {
        return "There was a network error while " + message + ". Are you connected to the internet?";
    }

    function deletedAlreadyMessage(message) {
        return "The article " + message + " may have already been deleted.";
    }

    function networkFailureError(message) {
        this.name = "NetworkFailureError";
        this.message = networkFailureMessage(message);
    }
    networkFailureError.prototype = new Error();
    networkFailureError.prototype.constructor = networkFailureError;

    function readabilityError(message) {
        this.name = "ReadabilityError";
        this.message = genericMessage(message);
    }
    readabilityError.prototype = new Error();
    readabilityError.prototype.constructor = readabilityError;

    function diskError(message) {
        this.name = "ReadabilityError";
        this.message = genericMessage(message);
    }
    diskError.prototype = new Error();
    diskError.prototype.constructor = diskError;

    


    WinJS.Namespace.define("Errors", {
        // Constants
        networkFailureError: networkFailureError,
        readabilityError: readabilityError,
        genericMessage: genericMessage,
        networkFailureMessage: networkFailureMessage,
        deletedAlreadyMessage: deletedAlreadyMessage,
        diskError: diskError
    });
})()